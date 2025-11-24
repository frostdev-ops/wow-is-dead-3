pub mod cms;
pub mod drafts;
pub mod files;
pub mod manifest;
pub mod launcher;

use anyhow::Result;
use crate::models::DraftRelease;
use std::path::{Path, PathBuf};
use uuid::Uuid;

// --- Drafts Wrappers ---

/// Create a new draft
pub async fn create_draft(storage_path: &PathBuf, version: Option<String>) -> Result<DraftRelease> {
    drafts::create_draft(storage_path, version).await
}

/// Update draft metadata
pub async fn update_draft(
    storage_path: &PathBuf,
    id: Uuid,
    version: Option<String>,
    minecraft_version: Option<String>,
    fabric_loader: Option<String>,
    changelog: Option<String>,
) -> Result<DraftRelease> {
    drafts::update_draft(storage_path, id, version, minecraft_version, fabric_loader, changelog).await
}

/// Read a draft release by ID
pub async fn read_draft(storage_path: &PathBuf, id: Uuid) -> Result<DraftRelease> {
    drafts::read_draft(storage_path, id).await
}

/// Delete draft
pub async fn delete_draft(storage_path: &PathBuf, id: Uuid) -> Result<()> {
    drafts::delete_draft(storage_path, id).await
}

/// List all drafts
pub async fn list_drafts(storage_path: &PathBuf) -> Result<Vec<DraftRelease>> {
    drafts::list_drafts(storage_path).await
}

/// Get path to draft files directory
pub fn get_draft_files_dir(storage_path: &PathBuf, id: Uuid) -> PathBuf {
    drafts::get_draft_files_dir(storage_path, id)
}

/// Set draft files list (replaces existing list)
pub async fn set_draft_files(
    storage_path: &PathBuf,
    id: Uuid,
    files: Vec<crate::models::DraftFile>,
) -> Result<DraftRelease> {
    drafts::set_draft_files(storage_path, id, files).await
}

/// Add files to draft (appends/updates)
pub async fn add_files_to_draft(
    storage_path: &PathBuf,
    id: Uuid,
    files: Vec<crate::models::DraftFile>,
) -> Result<DraftRelease> {
    drafts::add_files_to_draft(storage_path, id, files).await
}

/// Remove file from draft
pub async fn remove_file_from_draft(
    storage_path: &PathBuf,
    id: Uuid,
    file_path: &str,
    recursive: bool,
) -> Result<DraftRelease> {
    drafts::remove_file_from_draft(storage_path, id, file_path, recursive).await
}

/// Update file metadata in draft
pub async fn update_file_in_draft(
    storage_path: &PathBuf,
    id: Uuid,
    file_path: &str,
    sha256: Option<String>,
    url: Option<String>,
) -> Result<DraftRelease> {
    drafts::update_file_in_draft(storage_path, id, file_path, sha256, url).await
}

// --- Manifest Wrappers ---

pub async fn read_latest_manifest(config: &crate::config::Config) -> Result<crate::models::Manifest> {
    manifest::read_latest_manifest(config).await
}

pub async fn read_manifest(config: &crate::config::Config, version: &str) -> Result<crate::models::Manifest> {
    manifest::read_manifest(config, version).await
}

// --- CMS Wrappers ---

/// Load CMS configuration
pub async fn load_cms_config(storage_path: &Path) -> Result<crate::models::CmsConfig> {
    cms::load_cms_config(storage_path).await
}

/// Save CMS configuration
pub async fn save_cms_config(storage_path: &Path, config: &crate::models::CmsConfig) -> Result<()> {
    cms::save_cms_config(storage_path, config).await
}

/// Update CMS configuration
pub async fn update_cms_config(
    storage_path: &Path,
    updater: impl FnOnce(&mut crate::models::CmsConfig),
) -> Result<crate::models::CmsConfig> {
    cms::update_cms_config(storage_path, updater).await
}

/// List all assets
pub async fn list_assets(storage_path: &Path) -> Result<Vec<crate::models::AssetMetadata>> {
    cms::list_assets(storage_path).await
}

/// Save an asset
pub async fn save_asset(
    storage_path: &Path,
    filename: &str,
    data: &[u8],
) -> Result<crate::models::AssetMetadata> {
    cms::save_asset(storage_path, filename, data).await
}

/// Delete an asset
pub async fn delete_asset(storage_path: &Path, filename: &str) -> Result<()> {
    cms::delete_asset(storage_path, filename).await
}

/// Get asset file path
pub fn get_asset_file_path(storage_path: &Path, filename: &str) -> PathBuf {
    cms::get_asset_file_path(storage_path, filename)
}
