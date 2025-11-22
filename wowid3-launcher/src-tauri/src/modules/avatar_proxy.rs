use anyhow::Result;
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose::STANDARD, Engine};

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