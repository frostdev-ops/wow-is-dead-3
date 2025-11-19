use crate::models::{DraftFile, DraftRelease};
use anyhow::{Context, Result};
use chrono::Utc;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

/// Create a new draft release
pub async fn create_draft(storage_path: &Path, version: Option<String>) -> Result<DraftRelease> {
    let id = Uuid::new_v4();
    let draft_dir = storage_path.join("drafts").join(id.to_string());

    fs::create_dir_all(&draft_dir)
        .await
        .context("Failed to create draft directory")?;

    let draft = DraftRelease {
        id,
        version: version.unwrap_or_else(|| "0.0.0".to_string()),
        minecraft_version: String::new(),
        fabric_loader: String::new(),
        changelog: String::new(),
        files: Vec::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// Read a draft release by ID
pub async fn read_draft(storage_path: &Path, id: Uuid) -> Result<DraftRelease> {
    let metadata_path = storage_path.join("drafts").join(id.to_string()).join("metadata.json");

    let content = fs::read_to_string(&metadata_path)
        .await
        .context("Failed to read draft metadata")?;

    let draft: DraftRelease = serde_json::from_str(&content)
        .context("Failed to parse draft metadata")?;

    Ok(draft)
}

/// Write/update draft release with atomic write and fsync
pub async fn write_draft(storage_path: &Path, draft: &DraftRelease) -> Result<()> {
    let draft_dir = storage_path.join("drafts").join(draft.id.to_string());
    let metadata_path = draft_dir.join("metadata.json");

    fs::create_dir_all(&draft_dir)
        .await
        .context("Failed to create draft directory")?;

    let content = serde_json::to_string_pretty(draft)
        .context("Failed to serialize draft")?;

    // Atomic write with fsync for data integrity
    write_atomic(&metadata_path, content.as_bytes()).await?;

    Ok(())
}

/// Atomic write with fsync: write to temp file, fsync, then rename
async fn write_atomic(path: &PathBuf, content: &[u8]) -> Result<()> {
    let parent = path.parent().context("Invalid file path")?;
    let temp_path = parent.join(format!(".tmp.{}", uuid::Uuid::new_v4()));

    // Write to temp file
    let mut file = fs::File::create(&temp_path)
        .await
        .context("Failed to create temp file")?;

    file.write_all(content)
        .await
        .context("Failed to write to temp file")?;

    // Ensure data is written to disk
    file.sync_all()
        .await
        .context("Failed to sync temp file to disk")?;

    drop(file);

    // Atomic rename (atomic on Unix, near-atomic on Windows)
    fs::rename(&temp_path, path)
        .await
        .context("Failed to rename temp file to final path")?;

    tracing::debug!("Atomically wrote file: {}", path.display());
    Ok(())
}

/// Update draft with new data
pub async fn update_draft(
    storage_path: &Path,
    id: Uuid,
    version: Option<String>,
    minecraft_version: Option<String>,
    fabric_loader: Option<String>,
    changelog: Option<String>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id).await?;

    if let Some(v) = version {
        draft.version = v;
    }
    if let Some(mc) = minecraft_version {
        draft.minecraft_version = mc;
    }
    if let Some(fl) = fabric_loader {
        draft.fabric_loader = fl;
    }
    if let Some(cl) = changelog {
        draft.changelog = cl;
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// List all draft releases
pub async fn list_drafts(storage_path: &Path) -> Result<Vec<DraftRelease>> {
    let drafts_dir = storage_path.join("drafts");

    if !drafts_dir.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();
    let mut entries = fs::read_dir(&drafts_dir)
        .await
        .context("Failed to read drafts directory")?;

    while let Some(entry) = entries.next_entry().await? {
        if !entry.file_type().await?.is_dir() {
            continue;
        }

        let id_str = entry.file_name();
        let id = match Uuid::parse_str(id_str.to_string_lossy().as_ref()) {
            Ok(id) => id,
            Err(_) => continue,
        };

        if let Ok(draft) = read_draft(storage_path, id).await {
            drafts.push(draft);
        }
    }

    // Sort by updated_at descending
    drafts.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(drafts)
}

/// Delete a draft release
pub async fn delete_draft(storage_path: &Path, id: Uuid) -> Result<()> {
    let draft_dir = storage_path.join("drafts").join(id.to_string());

    if draft_dir.exists() {
        fs::remove_dir_all(&draft_dir)
            .await
            .context("Failed to delete draft directory")?;
    }

    Ok(())
}

/// Add files to draft from upload directory
pub async fn add_files_to_draft(
    storage_path: &Path,
    id: Uuid,
    files: Vec<DraftFile>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id).await?;

    // Add files to draft, avoiding duplicates
    for file in files {
        if !draft.files.iter().any(|f| f.path == file.path) {
            draft.files.push(file);
        }
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// Replace all files in a draft with new files
/// This is used when duplicating or copying releases to ensure deleted files are removed
pub async fn set_draft_files(
    storage_path: &Path,
    id: Uuid,
    files: Vec<DraftFile>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id).await?;

    // Replace entire file list
    draft.files = files;
    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// Remove a file from draft
pub async fn remove_file_from_draft(
    storage_path: &Path,
    id: Uuid,
    file_path: &str,
    recursive: bool,
) -> Result<DraftRelease> {
    // Validation
    if file_path.trim().is_empty() || file_path == "/" || file_path == "." {
        return Err(anyhow::anyhow!("Cannot delete the root files directory"));
    }
    if file_path.contains("..") {
        return Err(anyhow::anyhow!("Invalid file path: directory traversal not allowed"));
    }

    let mut draft = read_draft(storage_path, id).await?;

    let draft_dir = storage_path.join("drafts").join(id.to_string());
    let file_full_path = draft_dir.join("files").join(file_path);

    if file_full_path.exists() {
        let metadata = fs::metadata(&file_full_path).await?;
        if metadata.is_dir() {
            // Check if empty
            let mut read_dir = fs::read_dir(&file_full_path).await?;
            let is_empty = read_dir.next_entry().await?.is_none();

            if !is_empty && !recursive {
                return Err(anyhow::anyhow!("Directory is not empty"));
            }

            // Remove directory
            fs::remove_dir_all(&file_full_path).await?;

            // Remove all files in this directory from draft.files
            let prefix = format!("{}/", file_path.trim_end_matches('/'));
            draft.files.retain(|f| !f.path.starts_with(&prefix) && f.path != file_path);
        } else {
            fs::remove_file(&file_full_path).await?;
            draft.files.retain(|f| f.path != file_path);
        }
    } else {
        // File doesn't exist on disk, but might be in manifest
        draft.files.retain(|f| f.path != file_path);
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// Update file metadata in draft
pub async fn update_file_in_draft(
    storage_path: &Path,
    id: Uuid,
    file_path: &str,
    sha256: Option<String>,
    url: Option<String>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id).await?;

    if let Some(file) = draft.files.iter_mut().find(|f| f.path == file_path) {
        if let Some(hash) = sha256 {
            file.sha256 = hash;
        }
        if url.is_some() {
            file.url = url;
        }
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft).await?;

    Ok(draft)
}

/// Get draft files directory
pub fn get_draft_files_dir(storage_path: &Path, id: Uuid) -> PathBuf {
    storage_path.join("drafts").join(id.to_string()).join("files")
}
