use anyhow::Result;
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;
use std::fs;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvatarData {
    pub data: String, // Base64 encoded image data
    pub content_type: String,
}

/// Fetches a Minecraft avatar from the official APIs, proxying the request through the backend
/// Accepts either a username or a UUID
pub async fn fetch_avatar(username_or_uuid: &str) -> Result<AvatarData> {
    // Use official Minecraft API instead of third-party services
    let client = reqwest::Client::new();

    // Check if input is already a UUID (contains hyphens in UUID format)
    let uuid = if username_or_uuid.contains('-') && username_or_uuid.len() == 36 {
        // Already a UUID, use it directly (remove hyphens for Mojang API)
        username_or_uuid.replace("-", "")
    } else {
        // It's a username, need to look up the UUID
        let uuid_url = format!("https://api.mojang.com/users/profiles/minecraft/{}", username_or_uuid);
        let uuid_response = client
            .get(&uuid_url)
            .send()
            .await?;

        if !uuid_response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch player UUID"));
        }

        #[derive(Deserialize)]
        struct UuidResponse {
            id: String,
        }

        let uuid_data: UuidResponse = uuid_response.json().await?;
        uuid_data.id
    };

    // Fetch the skin data
    let skin_url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", uuid);
    let skin_response = client
        .get(&skin_url)
        .send()
        .await?;

    if !skin_response.status().is_success() {
        // Return a default avatar if player not found
        return Ok(AvatarData {
            data: DEFAULT_AVATAR_BASE64.to_string(),
            content_type: "image/png".to_string(),
        });
    }

    #[derive(Deserialize)]
    struct Property {
        value: String,
    }

    #[derive(Deserialize)]
    struct SkinResponse {
        properties: Vec<Property>,
    }

    let skin_data: SkinResponse = skin_response.json().await?;

    // The skin data is base64 encoded JSON
    if let Some(property) = skin_data.properties.first() {
        let decoded = STANDARD.decode(&property.value)?;
        let skin_json: serde_json::Value = serde_json::from_slice(&decoded)?;

        if let Some(textures) = skin_json.get("textures") {
            if let Some(skin) = textures.get("SKIN") {
                if let Some(url) = skin.get("url").and_then(|u| u.as_str()) {
                    // Download the actual skin image
                    let skin_image_response = client.get(url).send().await?;
                    let skin_bytes = skin_image_response.bytes().await?;

                    // Extract just the head portion (8x8 pixels from the top-left)
                    // For simplicity, we'll return the full skin and let the frontend handle cropping
                    let base64_data = STANDARD.encode(&skin_bytes);

                    return Ok(AvatarData {
                        data: base64_data,
                        content_type: "image/png".to_string(),
                    });
                }
            }
        }
    }

    // Return default avatar if we couldn't get the skin
    Ok(AvatarData {
        data: DEFAULT_AVATAR_BASE64.to_string(),
        content_type: "image/png".to_string(),
    })
}

// Simple 1x1 transparent PNG as a fallback
const DEFAULT_AVATAR_BASE64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/// Get the avatar cache directory path
pub fn get_avatar_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get cache dir: {}", e))?;

    let avatar_cache = cache_dir.join("avatars");

    // Create directory if it doesn't exist
    if !avatar_cache.exists() {
        fs::create_dir_all(&avatar_cache)?;
    }

    Ok(avatar_cache)
}

/// Check if an avatar is cached on disk
pub fn is_avatar_cached(app_handle: &tauri::AppHandle, identifier: &str) -> Result<bool> {
    let cache_dir = get_avatar_cache_dir(app_handle)?;
    let cache_file = cache_dir.join(format!("{}.png", identifier));
    Ok(cache_file.exists())
}

/// Read cached avatar from disk (returns base64 data URI)
pub fn read_cached_avatar(app_handle: &tauri::AppHandle, identifier: &str) -> Result<String> {
    let cache_dir = get_avatar_cache_dir(app_handle)?;
    let cache_file = cache_dir.join(format!("{}.png", identifier));

    if !cache_file.exists() {
        return Err(anyhow::anyhow!("Avatar not cached"));
    }

    let data = fs::read(&cache_file)?;
    let base64_data = STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", base64_data))
}

/// Write processed avatar head to disk cache
/// Accepts base64 data URI from frontend (already processed head image)
pub fn write_cached_avatar(
    app_handle: &tauri::AppHandle,
    identifier: &str,
    data_uri: &str,
) -> Result<()> {
    let cache_dir = get_avatar_cache_dir(app_handle)?;
    let cache_file = cache_dir.join(format!("{}.png", identifier));

    // Extract base64 data from data URI (format: "data:image/png;base64,...")
    let base64_data = data_uri
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| anyhow::anyhow!("Invalid data URI format"))?;

    let bytes = STANDARD.decode(base64_data)?;
    fs::write(&cache_file, bytes)?;

    Ok(())
}

/// Clear the entire avatar cache
pub fn clear_avatar_cache(app_handle: &tauri::AppHandle) -> Result<()> {
    let cache_dir = get_avatar_cache_dir(app_handle)?;

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)?;
        fs::create_dir_all(&cache_dir)?;
    }

    Ok(())
}