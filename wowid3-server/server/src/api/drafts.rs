use crate::api::admin::{AdminState, AppError};
use crate::middleware::AdminToken;
use crate::models::{
    AddFilesRequest, CreateDraftRequest, DraftFile, DraftRelease, GeneratedChangelog, Manifest,
    ManifestFile, UpdateDraftRequest, UpdateFileRequest, VersionSuggestions,
};
use crate::services::{analyze_files, generate_changelog, suggest_next_version, ChangeType};
use crate::storage;
use crate::utils;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono;
use globset::GlobSet;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;
use walkdir::WalkDir;

/// POST /api/admin/drafts - Create a new draft
pub async fn create_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Json(request): Json<CreateDraftRequest>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::create_draft(&state.config.storage_path(), request.version).await?;

    // If upload_id provided, add files from upload
    if let Some(upload_id) = request.upload_id {
        let upload_dir = state.config.uploads_path().join(&upload_id);
        if upload_dir.exists() {
            let files =
                scan_upload_files(&upload_dir, &state.config.base_url, &draft.id.to_string(), None)
                    .await?;
            let updated_draft =
                storage::add_files_to_draft(&state.config.storage_path(), draft.id, files).await?;

            // Copy files to draft directory
            let draft_files_dir =
                storage::get_draft_files_dir(&state.config.storage_path(), draft.id);
            copy_dir_all(&upload_dir, &draft_files_dir).await?;

            return Ok(Json(updated_draft));
        }
    }

    Ok(Json(draft))
}

/// GET /api/admin/drafts - List all drafts
pub async fn list_drafts(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<Vec<DraftRelease>>, AppError> {
    let drafts = storage::list_drafts(&state.config.storage_path()).await?;
    Ok(Json(drafts))
}

/// GET /api/admin/drafts/:id - Get specific draft
pub async fn get_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;
    Ok(Json(draft))
}

/// PUT /api/admin/drafts/:id - Update draft metadata
pub async fn update_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateDraftRequest>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::update_draft(
        &state.config.storage_path(),
        id,
        request.version,
        request.minecraft_version,
        request.fabric_loader,
        request.changelog,
    )
    .await?;

    Ok(Json(draft))
}

/// DELETE /api/admin/drafts/:id - Delete draft
pub async fn delete_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    storage::delete_draft(&state.config.storage_path(), id).await?;

    Ok(Json(json!({
        "message": "Draft deleted successfully",
        "id": id
    })))
}

/// POST /api/admin/drafts/:id/analyze - Analyze draft files and suggest versions
pub async fn analyze_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<VersionSuggestions>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);

    let mut suggestions = analyze_files(&draft_files_dir)?;

    // Suggest next version based on latest release
    let versions = storage::manifest::list_versions(&state.config).await?;
    if let Some(latest_version) = versions.first() {
        // Determine change type based on file changes
        let change_type = if draft.files.is_empty() {
            ChangeType::Patch
        } else {
            ChangeType::Minor // Default to minor for safety
        };

        suggestions.suggested_version = Some(suggest_next_version(latest_version, change_type));
    }

    Ok(Json(suggestions))
}

/// POST /api/admin/drafts/:id/files - Add files to draft
pub async fn add_files(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<AddFilesRequest>,
) -> Result<Json<DraftRelease>, AppError> {
    let upload_dir = state.config.uploads_path().join(&request.upload_id);

    if !upload_dir.exists() {
        return Err(AppError::NotFound("Upload not found".to_string()));
    }

    // Scan files from upload
    let target_path = request.target_path.as_deref();
    let files = scan_upload_files(&upload_dir, &state.config.base_url, &id.to_string(), target_path).await?;

    // Add to draft
    let draft = storage::add_files_to_draft(&state.config.storage_path(), id, files).await?;

    // Copy files to draft directory
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    
    // Determine destination directory
    let dest_dir = if let Some(path) = target_path {
        let path = path.trim_matches('/');
        if path.is_empty() {
            draft_files_dir
        } else {
            let joined = draft_files_dir.join(path);
            // Security check: ensure we don't escape draft directory
            // Since joined path might not exist, we check components
            if path.contains("..") {
                return Err(AppError::BadRequest("Invalid target path".to_string()));
            }
            joined
        }
    } else {
        draft_files_dir
    };

    copy_dir_all(&upload_dir, &dest_dir).await?;

    Ok(Json(draft))
}

#[derive(Deserialize)]
pub struct RecursiveParams {
    #[serde(default)]
    recursive: bool,
}

/// DELETE /api/admin/drafts/:id/files/*path - Remove file from draft
pub async fn remove_file(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path((id, file_path)): Path<(Uuid, String)>,
    Query(params): Query<RecursiveParams>,
) -> Result<Json<DraftRelease>, AppError> {
    match storage::remove_file_from_draft(&state.config.storage_path(), id, &file_path, params.recursive).await {
        Ok(draft) => Ok(Json(draft)),
        Err(e) => {
            if e.to_string().contains("Directory is not empty") {
                Err(AppError::BadRequest("Directory is not empty".to_string()))
            } else {
                Err(AppError::Internal(e))
            }
        }
    }
}

/// PUT /api/admin/drafts/:id/files/*path - Update file metadata
pub async fn update_file(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path((id, file_path)): Path<(Uuid, String)>,
    Json(request): Json<UpdateFileRequest>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::update_file_in_draft(
        &state.config.storage_path(),
        id,
        &file_path,
        request.sha256,
        request.url,
    )
    .await?;

    Ok(Json(draft))
}

/// POST /api/admin/drafts/:id/generate-changelog - Generate changelog from file diff
pub async fn generate_changelog_for_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<GeneratedChangelog>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;

    // Get the latest release manifest for comparison
    let previous_files = storage::manifest::read_latest_manifest(&state.config)
        .await
        .ok()
        .map(|m| m.files);

    let changelog =
        generate_changelog(&draft.files, previous_files.as_ref().map(|v| v.as_slice()))?;

    Ok(Json(changelog))
}

/// POST /api/admin/drafts/:id/publish - Publish draft as release
pub async fn publish_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = std::time::Instant::now();
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;

    // Validate draft has required fields
    if draft.version.is_empty()
        || draft.minecraft_version.is_empty()
        || draft.fabric_loader.is_empty()
    {
        return Err(AppError::BadRequest(
            "Draft missing required fields (version, minecraft_version, fabric_loader)".to_string(),
        ));
    }

    if draft.files.is_empty() {
        return Err(AppError::BadRequest("Draft has no files".to_string()));
    }

    // Create release directory
    let release_dir = state.config.release_path(&draft.version);
    if release_dir.exists() {
        return Err(AppError::BadRequest(format!(
            "Release version {} already exists",
            draft.version
        )));
    }

    fs::create_dir_all(&release_dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create release directory: {}", e))
    })?;

    // Copy files from draft to release
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    copy_dir_all(&draft_files_dir, &release_dir).await?;

    // Regenerate checksums from the actual files on disk to ensure accuracy
    // This is critical because files may have been edited via the file browser
    let verified_files = scan_directory_files(&release_dir).await?;

    // Load blacklist patterns to exclude files that should not be distributed
    let blacklist_patterns = utils::load_blacklist_patterns(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load blacklist: {}", e)))?;

    let glob_set = utils::compile_patterns(&blacklist_patterns).map_err(|e| {
        AppError::Internal(anyhow::anyhow!(
            "Failed to compile blacklist patterns: {}",
            e
        ))
    })?;

    let removed_blacklisted = remove_blacklisted_files(&release_dir, &glob_set).await?;
    if removed_blacklisted > 0 {
        tracing::warn!(
            "Removed {} blacklisted file(s) before publishing {}",
            removed_blacklisted,
            draft.version
        );
    }

    // Regenerate checksums from the actual files on disk to ensure accuracy
    // This is critical because files may have been edited via the file browser
    let verified_files = scan_directory_files(&release_dir).await?;

    if verified_files.is_empty() {
        return Err(AppError::BadRequest(
            "All files were filtered out by the blacklist. Adjust your blacklist or add files before publishing."
                .to_string(),
        ));
    }
    // Convert DraftFile to ManifestFile with fresh checksums and release URLs
    // Filter out blacklisted files to prevent download failures
    let total_files = verified_files.len();
    let mut manifest_files: Vec<ManifestFile> = verified_files
        .iter()
        .filter(|f| !utils::is_blacklisted(&f.path, &glob_set))
        .map(|f| ManifestFile {
            path: f.path.clone(),
            url: format!(
                "{}/files/{}/{}",
                state.config.base_url, draft.version, f.path
            ),
            sha256: f.sha256.clone(),
            size: f.size,
        })
        .collect();

    // Sort files by path for deterministic manifest generation
    manifest_files.sort_by(|a, b| a.path.cmp(&b.path));

    let filtered_count = total_files - manifest_files.len();
    if filtered_count > 0 {
        tracing::info!("Filtered {} blacklisted files from manifest", filtered_count);
    }

    // Create manifest
    let manifest = Manifest {
        version: draft.version.clone(),
        minecraft_version: draft.minecraft_version.clone(),
        fabric_loader: draft.fabric_loader.clone(),
        files: manifest_files,
        changelog: draft.changelog.clone(),
    };

    // Write manifest
    storage::manifest::write_manifest(&state.config, &manifest).await?;

    // Set as latest
    storage::manifest::set_latest_manifest(&state.config, &draft.version).await?;

    // Invalidate cache after publishing
    state.cache.invalidate_manifest("latest").await;
    state
        .cache
        .invalidate_manifest(&format!("version:{}", draft.version))
        .await;

    // Delete draft
    storage::delete_draft(&state.config.storage_path(), id).await?;

    let duration = start.elapsed();
    tracing::info!(
        "publish_draft completed in {:?} (version: {}, {} files)",
        duration,
        draft.version,
        manifest.files.len()
    );

    Ok(Json(json!({
        "message": "Draft published successfully",
        "version": draft.version,
        "file_count": manifest.files.len()
    })))
}

/// POST /api/admin/drafts/:id/duplicate - Duplicate a draft with all files
pub async fn duplicate_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<DraftRelease>, AppError> {
    let source_draft = storage::read_draft(&state.config.storage_path(), id).await?;

    // Create new draft with copied metadata
    let new_version = if !source_draft.version.is_empty() {
        Some(format!("{}-copy", source_draft.version))
    } else {
        None
    };

    let new_draft = storage::create_draft(&state.config.storage_path(), new_version).await?;

    // Copy metadata
    let updated_draft = storage::update_draft(
        &state.config.storage_path(),
        new_draft.id,
        Some(new_draft.version.clone()),
        Some(source_draft.minecraft_version.clone()),
        Some(source_draft.fabric_loader.clone()),
        Some(source_draft.changelog.clone()),
    )
    .await?;

    // Copy files if source draft has any
    if !source_draft.files.is_empty() {
        let source_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
        let dest_files_dir =
            storage::get_draft_files_dir(&state.config.storage_path(), new_draft.id);

        // Copy all files from source to destination
        copy_dir_all(&source_files_dir, &dest_files_dir).await?;

        // Regenerate checksums from copied files instead of copying old checksums
        let fresh_files = scan_directory_files(&dest_files_dir).await?;

        // Set files in draft with fresh checksums (replaces, not appends)
        let updated_draft =
            storage::set_draft_files(&state.config.storage_path(), new_draft.id, fresh_files)
                .await?;

        Ok(Json(updated_draft))
    } else {
        Ok(Json(updated_draft))
    }
}

/// File browser data structures
#[derive(Debug, Serialize, Deserialize)]
pub struct BrowseQuery {
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BrowseResponse {
    pub current_path: String,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateDirectoryRequest {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MoveRequest {
    pub source_path: String,
    pub dest_path: String,
}

/// GET /api/admin/drafts/:id/browse?path=... - Browse directory contents
pub async fn browse_directory(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Query(query): Query<BrowseQuery>,
) -> Result<Json<BrowseResponse>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);

    // Get target directory
    let target_dir = if let Some(ref path) = query.path {
        draft_files_dir.join(path)
    } else {
        draft_files_dir.clone()
    };

    // Security check: ensure we're not escaping the draft directory
    let canonical_target = target_dir
        .canonicalize()
        .map_err(|_| AppError::NotFound("Directory not found".to_string()))?;
    let canonical_base = draft_files_dir
        .canonicalize()
        .unwrap_or(draft_files_dir.clone());

    if !canonical_target.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid directory path".to_string()));
    }

    if !target_dir.exists() {
        // Create the directory if it doesn't exist
        fs::create_dir_all(&target_dir).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e))
        })?;
    }

    // Read directory entries
    let mut entries = Vec::new();
    let mut read_dir = fs::read_dir(&target_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read directory: {}", e)))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read entry: {}", e)))?
    {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry.path();
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to get metadata: {}", e)))?;

        let is_dir = metadata.is_dir();
        let size = if !is_dir { Some(metadata.len()) } else { None };

        // Get relative path from draft files dir
        let relative_path = file_path
            .strip_prefix(&draft_files_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_name.clone());

        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0))
            .flatten()
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());

        entries.push(FileEntry {
            name: file_name,
            path: relative_path,
            is_dir,
            size,
            modified,
        });
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(Json(BrowseResponse {
        current_path: query.path.unwrap_or_default(),
        entries,
    }))
}

/// GET /api/admin/drafts/:id/read-file?path=... - Read text file contents
pub async fn read_file_content(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Query(query): Query<ReadFileQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    let file_path = draft_files_dir.join(&query.path);

    // Security check
    let canonical_file = file_path
        .canonicalize()
        .map_err(|_| AppError::NotFound("File not found".to_string()))?;
    let canonical_base = draft_files_dir.canonicalize().unwrap_or(draft_files_dir);

    if !canonical_file.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid file path".to_string()));
    }

    if !file_path.exists() || !file_path.is_file() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    // Check if file is likely a text file
    let content = fs::read(&file_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;

    // Try to convert to UTF-8
    let text = String::from_utf8(content)
        .map_err(|_| AppError::BadRequest("File is not a text file".to_string()))?;

    Ok(Json(json!({
        "path": query.path,
        "content": text,
        "size": text.len()
    })))
}

/// PUT /api/admin/drafts/:id/write-file - Write/update text file contents
pub async fn write_file_content(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<WriteFileRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    let file_path = draft_files_dir.join(&request.path);

    // Security check - ensure we're not escaping the draft directory
    let parent_dir = file_path
        .parent()
        .ok_or_else(|| AppError::BadRequest("Invalid file path".to_string()))?;

    // Create parent directory if it doesn't exist
    fs::create_dir_all(&parent_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;

    let canonical_parent = parent_dir
        .canonicalize()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;
    let canonical_base = draft_files_dir
        .canonicalize()
        .unwrap_or(draft_files_dir.clone());

    if !canonical_parent.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid file path".to_string()));
    }

    // Write file
    fs::write(&file_path, request.content.as_bytes())
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e)))?;

    // Update draft file list with new/updated file
    let data = request.content.as_bytes();
    let mut hasher = Sha256::new();
    hasher.update(data);
    let sha256 = format!("{:x}", hasher.finalize());

    let draft_file = DraftFile {
        path: request.path.clone(),
        url: None,
        sha256: sha256.clone(),
        size: data.len() as u64,
    };

    // Try to update existing file or add new one
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;
    let mut files = draft.files;

    if let Some(existing) = files.iter_mut().find(|f| f.path == request.path) {
        existing.sha256 = sha256.clone();
        existing.size = data.len() as u64;
    } else {
        files.push(draft_file);
    }

    storage::add_files_to_draft(&state.config.storage_path(), id, files).await?;

    Ok(Json(json!({
        "message": "File saved successfully",
        "path": request.path,
        "size": data.len(),
        "sha256": sha256
    })))
}

/// POST /api/admin/drafts/:id/create-dir - Create new directory
pub async fn create_directory(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateDirectoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    let new_dir = draft_files_dir.join(&request.path);

    // Security check
    let parent = new_dir
        .parent()
        .ok_or_else(|| AppError::BadRequest("Invalid directory path".to_string()))?;

    fs::create_dir_all(&parent)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create parent: {}", e)))?;

    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;
    let canonical_base = draft_files_dir.canonicalize().unwrap_or(draft_files_dir);

    if !canonical_parent.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid directory path".to_string()));
    }

    // Create directory
    fs::create_dir_all(&new_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;

    Ok(Json(json!({
        "message": "Directory created successfully",
        "path": request.path
    })))
}

/// POST /api/admin/drafts/:id/rename - Rename file or directory
pub async fn rename_file(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<RenameRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    let old_path = draft_files_dir.join(&request.old_path);

    // Construct new path (same directory, different name)
    let parent = old_path
        .parent()
        .ok_or_else(|| AppError::BadRequest("Invalid path".to_string()))?;
    let new_path = parent.join(&request.new_name);

    // Security checks
    let canonical_old = old_path
        .canonicalize()
        .map_err(|_| AppError::NotFound("Source not found".to_string()))?;
    let canonical_base = draft_files_dir
        .canonicalize()
        .unwrap_or(draft_files_dir.clone());

    if !canonical_old.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid source path".to_string()));
    }

    // Rename
    fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to rename: {}", e)))?;

    // Update draft file list if it's a file
    if new_path.is_file() {
        let draft = storage::read_draft(&state.config.storage_path(), id).await?;
        let mut files = draft.files;

        let new_relative_path = new_path
            .strip_prefix(&draft_files_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| request.new_name.clone());

        if let Some(file) = files.iter_mut().find(|f| f.path == request.old_path) {
            file.path = new_relative_path.clone();
        }

        storage::add_files_to_draft(&state.config.storage_path(), id, files).await?;

        Ok(Json(json!({
            "message": "File renamed successfully",
            "old_path": request.old_path,
            "new_path": new_relative_path
        })))
    } else {
        Ok(Json(json!({
            "message": "Directory renamed successfully",
            "old_path": request.old_path,
            "new_name": request.new_name
        })))
    }
}

/// POST /api/admin/drafts/:id/move - Move file to different directory
pub async fn move_file(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
    Json(request): Json<MoveRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    let source_path = draft_files_dir.join(&request.source_path);
    let dest_path = draft_files_dir.join(&request.dest_path);

    // Security checks
    let canonical_source = source_path
        .canonicalize()
        .map_err(|_| AppError::NotFound("Source not found".to_string()))?;
    let canonical_base = draft_files_dir
        .canonicalize()
        .unwrap_or(draft_files_dir.clone());

    if !canonical_source.starts_with(&canonical_base) {
        return Err(AppError::BadRequest("Invalid source path".to_string()));
    }

    // Create destination parent if needed
    if let Some(dest_parent) = dest_path.parent() {
        fs::create_dir_all(dest_parent).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to create destination: {}", e))
        })?;
    }

    // Move
    fs::rename(&source_path, &dest_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to move: {}", e)))?;

    // Update draft file list
    let draft = storage::read_draft(&state.config.storage_path(), id).await?;
    let mut files = draft.files;

    if let Some(file) = files.iter_mut().find(|f| f.path == request.source_path) {
        file.path = request.dest_path.clone();
    }

    storage::add_files_to_draft(&state.config.storage_path(), id, files).await?;

    Ok(Json(json!({
        "message": "File moved successfully",
        "source_path": request.source_path,
        "dest_path": request.dest_path
    })))
}

// Helper functions

async fn scan_upload_files(
    upload_dir: &PathBuf,
    base_url: &str,
    draft_id: &str,
    target_path: Option<&str>,
) -> Result<Vec<DraftFile>, AppError> {
    let mut files = Vec::new();

    for entry in WalkDir::new(upload_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative_path = path
            .strip_prefix(upload_dir)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

        let relative_str = relative_path
            .to_str()
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid path encoding")))?;
        let relative_str = relative_str.replace('\\', "/");

        let final_path = if let Some(prefix) = target_path {
            let prefix = prefix.trim_matches('/');
            if prefix.is_empty() {
                relative_str
            } else {
                format!("{}/{}", prefix, relative_str)
            }
        } else {
            relative_str.clone()
        };

        // Calculate checksum
        let data = fs::read(path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;
        let mut hasher = Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        files.push(DraftFile {
            path: final_path.clone(),
            url: Some(format!(
                "{}/files/draft-{}/{}",
                base_url, draft_id, final_path
            )),
            sha256,
            size: data.len() as u64,
        });
    }

    Ok(files)
}

async fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<(), AppError> {
    fs::create_dir_all(dst)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;

    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let relative = path
                .strip_prefix(src)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

            let dest_path = dst.join(relative);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).await.map_err(|e| {
                    AppError::Internal(anyhow::anyhow!("Failed to create parent directory: {}", e))
                })?;
            }

            fs::copy(path, &dest_path)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to copy file: {}", e)))?;
        }
    }

    Ok(())
}

/// Scan a directory and generate DraftFile entries with fresh SHA256 checksums
async fn scan_directory_files(dir: &PathBuf) -> Result<Vec<DraftFile>, AppError> {
    let mut files = Vec::new();

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative_path = path
            .strip_prefix(dir)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

        let relative_str = relative_path
            .to_str()
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid path encoding")))?;
        let relative_str = relative_str.replace('\\', "/");

        // Skip manifest.json - it's generated, not part of the modpack files
        if relative_str == "manifest.json" {
            continue;
        }

        // Calculate fresh checksum
        let data = fs::read(path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;
        let mut hasher = Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        files.push(DraftFile {
            path: relative_str,
            url: None, // URLs are generated when publishing
            sha256,
            size: data.len() as u64,
        });
    }

    Ok(files)
}

async fn remove_blacklisted_files(dir: &PathBuf, glob_set: &GlobSet) -> Result<usize, AppError> {
    let mut removed = 0;

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative_path = path
            .strip_prefix(dir)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

        let relative_str = relative_path
            .to_str()
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid path encoding")))?;
        let relative_str = relative_str.replace('\\', "/");

        if glob_set.is_match(&relative_str) {
            fs::remove_file(path).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to remove {}: {}", relative_str, e))
            })?;
            removed += 1;
            tracing::debug!("Removed blacklisted file: {}", relative_str);
        }
    }

    Ok(removed)
}
