use crate::config::Config;
use crate::models::{Manifest, ManifestFile};
use crate::storage::manifest::{read_manifest, set_latest_manifest, write_manifest};
use crate::utils;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use globset::GlobSet;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::fs;
use walkdir::WalkDir;

#[derive(Parser)]
#[command(name = "wowid3-server")]
#[command(about = "WOWID3 Modpack Server", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Regenerate manifest for a release by scanning files on disk
    RegenerateManifest {
        /// Version number to regenerate (e.g., "1.0.3")
        #[arg(value_name = "VERSION")]
        version: String,

        /// Also update latest.json to point to this version
        #[arg(long)]
        set_latest: bool,
    },
}

/// Run CLI command
pub async fn run_cli(cli: Cli, config: Config) -> Result<()> {
    match cli.command {
        Some(Commands::RegenerateManifest {
            version,
            set_latest,
        }) => {
            regenerate_manifest(&config, &version, set_latest).await?;
        }
        None => {
            // No command provided, return to start server
            return Ok(());
        }
    }
    Ok(())
}

/// Regenerate manifest for a release version by scanning files on disk
async fn regenerate_manifest(config: &Config, version: &str, set_latest: bool) -> Result<()> {
    tracing::info!("Regenerating manifest for version {}", version);

    // Get release directory path
    let release_dir = config.storage_path().join("releases").join(version);

    // Check if release directory exists
    if !release_dir.exists() {
        anyhow::bail!(
            "Release directory does not exist: {}",
            release_dir.display()
        );
    }

    // Try to read existing manifest to preserve metadata
    let (minecraft_version, fabric_loader, changelog) = match read_manifest(config, version).await {
        Ok(existing_manifest) => {
            tracing::info!("Found existing manifest, preserving metadata");
            (
                existing_manifest.minecraft_version,
                existing_manifest.fabric_loader,
                existing_manifest.changelog,
            )
        }
        Err(e) => {
            tracing::warn!("Could not read existing manifest: {}. Using defaults.", e);
            (
                "1.21.4".to_string(),  // Default Minecraft version
                "0.16.14".to_string(), // Default Fabric Loader version
                String::new(),         // Empty changelog
            )
        }
    };

    tracing::info!("Scanning files in: {}", release_dir.display());

    // Load blacklist patterns to exclude player/local data
    let blacklist_patterns = utils::load_blacklist_patterns(config).await?;
    let glob_set = utils::compile_patterns(&blacklist_patterns)?;

    let removed_blacklisted = remove_blacklisted_files(&release_dir, &glob_set).await?;
    if removed_blacklisted > 0 {
        tracing::warn!(
            "Removed {} blacklisted file(s) while regenerating {}",
            removed_blacklisted,
            version
        );
    }

    // Scan all files and calculate fresh checksums
    let files = scan_release_files(&release_dir, config, version, Some(&glob_set)).await?;

    tracing::info!("Found {} files", files.len());

    if files.is_empty() {
        anyhow::bail!("No files found in release directory!");
    }

    // Create manifest with fresh checksums but preserved metadata
    let manifest = Manifest {
        version: version.to_string(),
        minecraft_version,
        fabric_loader,
        files,
        changelog,
    };

    // Write manifest (with validation and atomic write)
    tracing::info!("Writing manifest to disk...");
    write_manifest(config, &manifest).await?;

    tracing::info!("✓ Manifest regenerated successfully!");
    tracing::info!("  Version: {}", version);
    tracing::info!("  Minecraft: {}", manifest.minecraft_version);
    tracing::info!("  Fabric Loader: {}", manifest.fabric_loader);
    tracing::info!("  Files: {}", manifest.files.len());
    tracing::info!("  Location: {}/manifest.json", release_dir.display());

    // Optionally update latest.json
    if set_latest {
        tracing::info!("Updating latest.json to point to version {}...", version);
        set_latest_manifest(config, version).await?;
        tracing::info!("✓ Updated latest.json");
    }

    Ok(())
}

/// Scan release directory and generate ManifestFile entries with fresh SHA256 checksums
async fn scan_release_files(
    dir: &PathBuf,
    config: &Config,
    version: &str,
    blacklist: Option<&GlobSet>,
) -> Result<Vec<ManifestFile>> {
    // Load blacklist patterns to exclude files that should not be distributed
    let blacklist_patterns = utils::load_blacklist_patterns(config).await?;
    let glob_set = utils::compile_patterns(&blacklist_patterns)?;

    let mut files = Vec::new();
    let mut file_count = 0;
    let mut filtered_count = 0;

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

        // Skip manifest.json itself
        if path.file_name().and_then(|n| n.to_str()) == Some("manifest.json") {
            continue;
        }

        let relative_path = path
            .strip_prefix(dir)
            .context("Failed to get relative path")?;

        let relative_str_raw = relative_path
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid path encoding"))?;
        let relative_str = relative_str_raw.replace('\\', "/");

        if let Some(glob) = blacklist {
            if glob.is_match(&relative_str) {
                tracing::debug!("Skipping blacklisted file while scanning: {}", relative_str);
                continue;
            }
        }

        // Skip blacklisted files
        if utils::is_blacklisted(&relative_str, &glob_set) {
            filtered_count += 1;
            continue;
        }

        // Calculate fresh checksum
        let data = fs::read(path)
            .await
            .with_context(|| format!("Failed to read file: {}", path.display()))?;

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        file_count += 1;
        if file_count % 100 == 0 {
            tracing::info!("  Processed {} files...", file_count);
        }

        files.push(ManifestFile {
            path: relative_str.clone(),
            url: format!("{}/files/{}/{}", config.base_url, version, relative_str),
            sha256,
            size: data.len() as u64,
        });
    }

    if filtered_count > 0 {
        tracing::info!("  Filtered {} blacklisted files from manifest", filtered_count);
    }

    Ok(files)
}

async fn remove_blacklisted_files(dir: &PathBuf, glob_set: &GlobSet) -> Result<usize> {
    let mut removed = 0;

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative_path = path
            .strip_prefix(dir)
            .context("Failed to get relative path")?;

        let relative_str = relative_path
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid path encoding"))?;
        let relative_str = relative_str.replace('\\', "/");

        if glob_set.is_match(&relative_str) {
            fs::remove_file(path)
                .await
                .with_context(|| format!("Failed to remove blacklisted file {}", relative_str))?;
            removed += 1;
        }
    }

    Ok(removed)
}
