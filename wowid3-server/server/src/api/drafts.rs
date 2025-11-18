use crate::api::admin::{AdminState, AppError};
use crate::middleware::AdminToken;
use crate::models::{
    AddFilesRequest, CreateDraftRequest, DraftFile, DraftRelease, GeneratedChangelog,
    Manifest, ManifestFile, UpdateDraftRequest, UpdateFileRequest, VersionSuggestions,
};
use crate::services::{analyze_files, generate_changelog, suggest_next_version, ChangeType};
use crate::storage;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
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
    let draft = storage::create_draft(&state.config.storage_path(), request.version)?;

    // If upload_id provided, add files from upload
    if let Some(upload_id) = request.upload_id {
        let upload_dir = state.config.uploads_path().join(&upload_id);
        if upload_dir.exists() {
            let files = scan_upload_files(&upload_dir, &state.config.base_url, &draft.id.to_string()).await?;
            let updated_draft = storage::add_files_to_draft(&state.config.storage_path(), draft.id, files)?;

            // Copy files to draft directory
            let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), draft.id);
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
    let drafts = storage::list_drafts(&state.config.storage_path())?;
    Ok(Json(drafts))
}

/// GET /api/admin/drafts/:id - Get specific draft
pub async fn get_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id)?;
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
    )?;

    Ok(Json(draft))
}

/// DELETE /api/admin/drafts/:id - Delete draft
pub async fn delete_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    storage::delete_draft(&state.config.storage_path(), id)?;

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
    let draft = storage::read_draft(&state.config.storage_path(), id)?;
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
    let files = scan_upload_files(&upload_dir, &state.config.base_url, &id.to_string()).await?;

    // Add to draft
    let draft = storage::add_files_to_draft(&state.config.storage_path(), id, files)?;

    // Copy files to draft directory
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    copy_dir_all(&upload_dir, &draft_files_dir).await?;

    Ok(Json(draft))
}

/// DELETE /api/admin/drafts/:id/files/*path - Remove file from draft
pub async fn remove_file(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path((id, file_path)): Path<(Uuid, String)>,
) -> Result<Json<DraftRelease>, AppError> {
    let draft = storage::remove_file_from_draft(&state.config.storage_path(), id, &file_path)?;
    Ok(Json(draft))
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
    )?;

    Ok(Json(draft))
}

/// POST /api/admin/drafts/:id/generate-changelog - Generate changelog from file diff
pub async fn generate_changelog_for_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<GeneratedChangelog>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id)?;

    // Get previous version files
    let versions = storage::manifest::list_versions(&state.config).await?;
    let previous_files = if let Some(prev_version) = versions.first() {
        storage::manifest::read_manifest(&state.config, prev_version)
            .await
            .ok()
            .map(|m| m.files)
    } else {
        None
    };

    let changelog = generate_changelog(
        &draft.files,
        previous_files.as_ref().map(|v| v.as_slice()),
    )?;

    Ok(Json(changelog))
}

/// POST /api/admin/drafts/:id/publish - Publish draft as release
pub async fn publish_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let draft = storage::read_draft(&state.config.storage_path(), id)?;

    // Validate draft has required fields
    if draft.version.is_empty() || draft.minecraft_version.is_empty() || draft.fabric_loader.is_empty() {
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

    fs::create_dir_all(&release_dir).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create release directory: {}", e)))?;

    // Copy files from draft to release
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), id);
    copy_dir_all(&draft_files_dir, &release_dir).await?;

    // Convert DraftFile to ManifestFile
    let manifest_files: Vec<ManifestFile> = draft
        .files
        .iter()
        .map(|f| ManifestFile {
            path: f.path.clone(),
            url: f.url.clone().unwrap_or_else(|| {
                format!(
                    "{}/files/{}/{}",
                    state.config.base_url, draft.version, f.path
                )
            }),
            sha256: f.sha256.clone(),
            size: f.size,
        })
        .collect();

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

    // Delete draft
    storage::delete_draft(&state.config.storage_path(), id)?;

    Ok(Json(json!({
        "message": "Draft published successfully",
        "version": draft.version,
        "file_count": manifest.files.len()
    })))
}

// Helper functions

async fn scan_upload_files(
    upload_dir: &PathBuf,
    base_url: &str,
    draft_id: &str,
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

        // Calculate checksum
        let data = fs::read(path).await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;
        let mut hasher = Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        files.push(DraftFile {
            path: relative_str.to_string(),
            url: Some(format!("{}/files/draft-{}/{}", base_url, draft_id, relative_str)),
            sha256,
            size: data.len() as u64,
        });
    }

    Ok(files)
}

async fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<(), AppError> {
    fs::create_dir_all(dst).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;

    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let relative = path
                .strip_prefix(src)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

            let dest_path = dst.join(relative);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).await
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create parent directory: {}", e)))?;
            }

            fs::copy(path, &dest_path).await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to copy file: {}", e)))?;
        }
    }

    Ok(())
}
