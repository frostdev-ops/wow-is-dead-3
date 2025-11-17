use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncReadExt;

/// Calculate SHA256 checksum of a file
pub async fn calculate_checksum(file_path: &Path) -> Result<String> {
    let mut file = fs::File::open(file_path)
        .await
        .context("Failed to open file for checksum")?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 8192]; // 8KB buffer

    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let hash = format!("{:x}", hasher.finalize());
    Ok(hash)
}

/// Get file size in bytes
pub async fn get_file_size(file_path: &Path) -> Result<u64> {
    let metadata = fs::metadata(file_path)
        .await
        .context("Failed to read file metadata")?;

    Ok(metadata.len())
}

/// Copy a file from source to destination
pub async fn copy_file(from: &Path, to: &Path) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).await?;
    }

    fs::copy(from, to)
        .await
        .context("Failed to copy file")?;

    Ok(())
}

/// Delete a directory and all its contents
pub async fn delete_directory(path: &Path) -> Result<()> {
    if path.exists() {
        fs::remove_dir_all(path)
            .await
            .context("Failed to delete directory")?;
    }
    Ok(())
}

/// Walk a directory recursively and return all file paths relative to base
pub async fn walk_directory(base_path: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();

    let mut stack = vec![base_path.to_path_buf()];

    while let Some(current) = stack.pop() {
        let mut entries = fs::read_dir(&current)
            .await
            .context("Failed to read directory")?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            let file_type = entry.file_type().await?;

            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() {
                // Get relative path from base
                if let Ok(relative) = path.strip_prefix(base_path) {
                    files.push(relative.to_path_buf());
                }
            }
        }
    }

    Ok(files)
}

/// Check if a path matches any of the blacklist patterns (glob)
pub fn matches_blacklist(path: &Path, blacklist_patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();

    for pattern in blacklist_patterns {
        if let Ok(glob_pattern) = glob::Pattern::new(pattern) {
            if glob_pattern.matches(&path_str) {
                return true;
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_matches_blacklist() {
        let patterns = vec![
            "optifine.txt".to_string(),
            "**/*.log".to_string(),
            "journeymap/**".to_string(),
        ];

        assert!(matches_blacklist(&PathBuf::from("optifine.txt"), &patterns));
        assert!(matches_blacklist(&PathBuf::from("logs/debug.log"), &patterns));
        assert!(matches_blacklist(&PathBuf::from("journeymap/config.json"), &patterns));
        assert!(!matches_blacklist(&PathBuf::from("config/mod.toml"), &patterns));
    }
}
