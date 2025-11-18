use crate::models::{DraftFile, DraftRelease};
use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Create a new draft release
pub fn create_draft(storage_path: &Path, version: Option<String>) -> Result<DraftRelease> {
    let id = Uuid::new_v4();
    let draft_dir = storage_path.join("drafts").join(id.to_string());

    fs::create_dir_all(&draft_dir)
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

    write_draft(storage_path, &draft)?;

    Ok(draft)
}

/// Read a draft release by ID
pub fn read_draft(storage_path: &Path, id: Uuid) -> Result<DraftRelease> {
    let metadata_path = storage_path.join("drafts").join(id.to_string()).join("metadata.json");

    let content = fs::read_to_string(&metadata_path)
        .context("Failed to read draft metadata")?;

    let draft: DraftRelease = serde_json::from_str(&content)
        .context("Failed to parse draft metadata")?;

    Ok(draft)
}

/// Write/update draft release
pub fn write_draft(storage_path: &Path, draft: &DraftRelease) -> Result<()> {
    let draft_dir = storage_path.join("drafts").join(draft.id.to_string());
    let metadata_path = draft_dir.join("metadata.json");

    fs::create_dir_all(&draft_dir)
        .context("Failed to create draft directory")?;

    let content = serde_json::to_string_pretty(draft)
        .context("Failed to serialize draft")?;

    fs::write(&metadata_path, content)
        .context("Failed to write draft metadata")?;

    Ok(())
}

/// Update draft with new data
pub fn update_draft(
    storage_path: &Path,
    id: Uuid,
    version: Option<String>,
    minecraft_version: Option<String>,
    fabric_loader: Option<String>,
    changelog: Option<String>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id)?;

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

    write_draft(storage_path, &draft)?;

    Ok(draft)
}

/// List all draft releases
pub fn list_drafts(storage_path: &Path) -> Result<Vec<DraftRelease>> {
    let drafts_dir = storage_path.join("drafts");

    if !drafts_dir.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();

    for entry in fs::read_dir(&drafts_dir).context("Failed to read drafts directory")? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let id_str = entry.file_name();
        let id = match Uuid::parse_str(id_str.to_string_lossy().as_ref()) {
            Ok(id) => id,
            Err(_) => continue,
        };

        if let Ok(draft) = read_draft(storage_path, id) {
            drafts.push(draft);
        }
    }

    // Sort by updated_at descending
    drafts.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(drafts)
}

/// Delete a draft release
pub fn delete_draft(storage_path: &Path, id: Uuid) -> Result<()> {
    let draft_dir = storage_path.join("drafts").join(id.to_string());

    if draft_dir.exists() {
        fs::remove_dir_all(&draft_dir)
            .context("Failed to delete draft directory")?;
    }

    Ok(())
}

/// Add files to draft from upload directory
pub fn add_files_to_draft(
    storage_path: &Path,
    id: Uuid,
    files: Vec<DraftFile>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id)?;

    // Add files to draft, avoiding duplicates
    for file in files {
        if !draft.files.iter().any(|f| f.path == file.path) {
            draft.files.push(file);
        }
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft)?;

    Ok(draft)
}

/// Remove a file from draft
pub fn remove_file_from_draft(
    storage_path: &Path,
    id: Uuid,
    file_path: &str,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id)?;

    draft.files.retain(|f| f.path != file_path);
    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft)?;

    // Also delete the physical file
    let draft_dir = storage_path.join("drafts").join(id.to_string());
    let file_full_path = draft_dir.join("files").join(file_path);

    if file_full_path.exists() {
        fs::remove_file(&file_full_path).ok();
    }

    Ok(draft)
}

/// Update file metadata in draft
pub fn update_file_in_draft(
    storage_path: &Path,
    id: Uuid,
    file_path: &str,
    sha256: Option<String>,
    url: Option<String>,
) -> Result<DraftRelease> {
    let mut draft = read_draft(storage_path, id)?;

    if let Some(file) = draft.files.iter_mut().find(|f| f.path == file_path) {
        if let Some(hash) = sha256 {
            file.sha256 = hash;
        }
        if url.is_some() {
            file.url = url;
        }
    }

    draft.updated_at = Utc::now();

    write_draft(storage_path, &draft)?;

    Ok(draft)
}

/// Get draft files directory
pub fn get_draft_files_dir(storage_path: &Path, id: Uuid) -> PathBuf {
    storage_path.join("drafts").join(id.to_string()).join("files")
}
