use crate::models::{DraftFile, GeneratedChangelog, ManifestFile};
use anyhow::Result;
use regex::Regex;
use std::collections::{HashMap, HashSet};

/// Generate changelog by comparing two file lists
pub fn generate_changelog(
    current_files: &[DraftFile],
    previous_files: Option<&[ManifestFile]>,
) -> Result<GeneratedChangelog> {
    let mut added = Vec::new();
    let mut changed = Vec::new();
    let mut removed = Vec::new();

    if let Some(prev_files) = previous_files {
        // Create lookup maps
        let prev_map: HashMap<&str, &ManifestFile> = prev_files
            .iter()
            .map(|f| (f.path.as_str(), f))
            .collect();

        let _current_map: HashMap<&str, &DraftFile> = current_files
            .iter()
            .map(|f| (f.path.as_str(), f))
            .collect();

        // Find added and changed files
        for file in current_files {
            if let Some(prev_file) = prev_map.get(file.path.as_str()) {
                // File exists in both - check if changed
                if file.sha256 != prev_file.sha256 {
                    changed.push(describe_file_change(file, Some(prev_file)));
                }
            } else {
                // File is new
                added.push(describe_file(&file.path));
            }
        }

        // Find removed files
        let current_paths: HashSet<&str> = current_files.iter().map(|f| f.path.as_str()).collect();

        for prev_file in prev_files {
            if !current_paths.contains(prev_file.path.as_str()) {
                removed.push(describe_file(&prev_file.path));
            }
        }
    } else {
        // No previous version - all files are new
        for file in current_files {
            added.push(describe_file(&file.path));
        }
    }

    // Generate markdown
    let markdown = format_changelog(&added, &changed, &removed);

    Ok(GeneratedChangelog {
        markdown,
        added,
        changed,
        removed,
    })
}

/// Describe a file in human-readable format
fn describe_file(path: &str) -> String {
    // For mods, extract name from filename
    if path.starts_with("mods/") {
        let filename = path.strip_prefix("mods/").unwrap_or(path);
        if let Some(mod_name) = extract_mod_name(filename) {
            return mod_name;
        }
    }

    // For other files, use the full path
    path.to_string()
}

/// Describe a file change with version information if available
fn describe_file_change(current: &DraftFile, previous: Option<&ManifestFile>) -> String {
    let path = &current.path;

    if path.starts_with("mods/") {
        let current_filename = path.strip_prefix("mods/").unwrap_or(path);

        if let Some(prev) = previous {
            let prev_filename = prev.path.strip_prefix("mods/").unwrap_or(&prev.path);

            let current_version = extract_version(current_filename);
            let prev_version = extract_version(prev_filename);

            if let (Some(name), Some(curr_ver), Some(prev_ver)) = (
                extract_mod_name(current_filename),
                current_version,
                prev_version,
            ) {
                return format!("{} ({} → {})", name, prev_ver, curr_ver);
            }

            if let Some(name) = extract_mod_name(current_filename) {
                return format!("{} (updated)", name);
            }
        }
    }

    path.to_string()
}

/// Extract mod name from filename (removes version)
fn extract_mod_name(filename: &str) -> Option<String> {
    let version_regex = Regex::new(r"[\-_](\d+\.\d+(?:\.\d+)?(?:\.\d+)?)").unwrap();

    // Remove .jar extension
    let name = filename.strip_suffix(".jar").unwrap_or(filename);

    // Remove version if found
    if let Some(captures) = version_regex.captures(name) {
        if let Some(m) = captures.get(0) {
            let cleaned = name[..m.start()].to_string();
            return Some(cleaned.replace('-', " ").replace('_', " "));
        }
    }

    Some(name.replace('-', " ").replace('_', " "))
}

/// Extract version from filename
fn extract_version(filename: &str) -> Option<String> {
    let version_regex = Regex::new(r"[\-_](\d+\.\d+(?:\.\d+)?(?:\.\d+)?)").unwrap();

    version_regex
        .captures(filename)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

/// Format changelog sections as markdown
fn format_changelog(added: &[String], changed: &[String], removed: &[String]) -> String {
    let mut sections = Vec::new();

    if !added.is_empty() {
        let mut section = String::from("## Added\n\n");
        for item in added {
            section.push_str(&format!("- {}\n", item));
        }
        sections.push(section);
    }

    if !changed.is_empty() {
        let mut section = String::from("## Changed\n\n");
        for item in changed {
            section.push_str(&format!("- {}\n", item));
        }
        sections.push(section);
    }

    if !removed.is_empty() {
        let mut section = String::from("## Removed\n\n");
        for item in removed {
            section.push_str(&format!("- {}\n", item));
        }
        sections.push(section);
    }

    if sections.is_empty() {
        return String::from("No changes detected.");
    }

    sections.join("\n")
}
