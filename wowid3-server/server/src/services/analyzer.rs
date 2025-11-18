use crate::models::{ModInfo, VersionSuggestions};
use anyhow::{Context, Result};
use regex::Regex;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;
use zip::ZipArchive;

/// Analyze uploaded files and suggest versions
pub fn analyze_files(files_dir: &Path) -> Result<VersionSuggestions> {
    let mut detected_mods = Vec::new();
    let mut minecraft_versions = HashMap::new();
    let mut fabric_versions = HashMap::new();

    // Walk through all JAR files in mods directory
    let mods_dir = files_dir.join("mods");
    if mods_dir.exists() {
        for entry in WalkDir::new(&mods_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jar") {
                if let Ok(mod_info) = read_jar_metadata(path) {
                    // Track Minecraft versions
                    if let Some(ref mc_ver) = mod_info.minecraft_version {
                        *minecraft_versions.entry(mc_ver.clone()).or_insert(0) += 1;
                    }

                    // Track Fabric versions
                    if let Some(ref fl_ver) = mod_info.fabric_loader {
                        *fabric_versions.entry(fl_ver.clone()).or_insert(0) += 1;
                    }

                    detected_mods.push(mod_info);
                }
            }
        }
    }

    // Find most common versions
    let minecraft_version = minecraft_versions
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(version, _)| version);

    let fabric_loader = fabric_versions
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(version, _)| version);

    // Suggest semantic version based on latest
    let suggested_version = None; // Will be set by API endpoint based on latest release

    Ok(VersionSuggestions {
        minecraft_version,
        fabric_loader,
        suggested_version,
        detected_mods,
    })
}

/// Read metadata from a JAR file
fn read_jar_metadata(jar_path: &Path) -> Result<ModInfo> {
    let file = File::open(jar_path)
        .context("Failed to open JAR file")?;

    let mut archive = ZipArchive::new(file)
        .context("Failed to read JAR archive")?;

    // Try to read fabric.mod.json first (Fabric mods)
    if let Ok(fabric_metadata) = read_fabric_metadata(&mut archive) {
        return Ok(fabric_metadata);
    }

    // Fallback: try to extract from filename
    extract_from_filename(jar_path)
}

/// Read Fabric mod metadata from fabric.mod.json
fn read_fabric_metadata(archive: &mut ZipArchive<File>) -> Result<ModInfo> {
    let mut file = archive.by_name("fabric.mod.json")
        .context("fabric.mod.json not found")?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .context("Failed to read fabric.mod.json")?;

    let json: serde_json::Value = serde_json::from_str(&contents)
        .context("Failed to parse fabric.mod.json")?;

    let mod_id = json["id"].as_str().unwrap_or("unknown").to_string();
    let name = json["name"].as_str().unwrap_or(&mod_id).to_string();
    let version = json["version"].as_str().unwrap_or("unknown").to_string();

    // Extract Minecraft version from depends
    let minecraft_version = json["depends"]["minecraft"]
        .as_str()
        .map(|s| clean_version_range(s));

    // Extract Fabric Loader version
    let fabric_loader = json["depends"]["fabricloader"]
        .as_str()
        .map(|s| clean_version_range(s));

    Ok(ModInfo {
        mod_id,
        name,
        version,
        minecraft_version,
        fabric_loader,
    })
}

/// Extract mod info from filename as fallback
fn extract_from_filename(path: &Path) -> Result<ModInfo> {
    let filename = path.file_stem()
        .and_then(|s| s.to_str())
        .context("Invalid filename")?;

    // Try to match common patterns like "modname-1.2.3"
    let version_regex = Regex::new(r"[\-_](\d+\.\d+(?:\.\d+)?(?:\.\d+)?)").unwrap();

    let version = version_regex
        .captures(filename)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let mod_id = filename.to_string();

    Ok(ModInfo {
        mod_id,
        name: filename.to_string(),
        version,
        minecraft_version: None,
        fabric_loader: None,
    })
}

/// Clean version range strings (e.g., ">=1.20.1" -> "1.20.1")
fn clean_version_range(version: &str) -> String {
    // Remove common version range operators
    version
        .replace(">=", "")
        .replace("<=", "")
        .replace(">", "")
        .replace("<", "")
        .replace("~", "")
        .replace("^", "")
        .trim()
        .to_string()
}

/// Suggest next semantic version based on change type
pub fn suggest_next_version(current: &str, change_type: ChangeType) -> String {
    let parts: Vec<&str> = current.split('.').collect();

    if parts.len() < 3 {
        return current.to_string();
    }

    let major: u32 = parts[0].parse().unwrap_or(0);
    let minor: u32 = parts[1].parse().unwrap_or(0);
    let patch: u32 = parts[2].parse().unwrap_or(0);

    match change_type {
        ChangeType::Major => format!("{}.0.0", major + 1),
        ChangeType::Minor => format!("{}.{}.0", major, minor + 1),
        ChangeType::Patch => format!("{}.{}.{}", major, minor, patch + 1),
    }
}

/// Type of version change
pub enum ChangeType {
    Major,
    Minor,
    Patch,
}
