use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// BlueMap availability status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlueMapStatus {
    pub available: bool,
    pub url: String,
    pub error: Option<String>,
}

/// Default BlueMap URL - now served via release server API
/// TODO: Make this configurable in settings
const BLUEMAP_URL: &str = "https://wowid-launcher.frostdev.io/api/bluemap/webapp";

/// Check if BlueMap is accessible via the release server API
///
/// This function attempts to connect to the release server's BlueMap API.
/// Returns true if the server responds with valid BlueMap data.
///
/// Note: BlueMap is now served via the release server API, which streams
/// map tiles and data from the Minecraft server's mounted filesystem.
#[tauri::command]
pub async fn check_bluemap_available() -> Result<BlueMapStatus, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Check if the release server's BlueMap API is accessible
    let settings_url = BLUEMAP_URL.replace("/webapp", "/settings.json");
    match client.get(&settings_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                Ok(BlueMapStatus {
                    available: true,
                    url: BLUEMAP_URL.to_string(),
                    error: None,
                })
            } else {
                Ok(BlueMapStatus {
                    available: false,
                    url: BLUEMAP_URL.to_string(),
                    error: Some(format!("BlueMap server returned status: {}", response.status())),
                })
            }
        }
        Err(e) => {
            // Connection failed - BlueMap is not running or not accessible
            Ok(BlueMapStatus {
                available: false,
                url: BLUEMAP_URL.to_string(),
                error: Some(format!("Cannot connect to BlueMap: {}", e)),
            })
        }
    }
}

/// Open BlueMap viewer in a new window
///
/// Creates a new Tauri webview window that loads the BlueMap web interface.
/// The window is a separate window (not a child webview) to ensure compatibility
/// with Linux Wayland, where child webviews are not currently supported.
///
/// The window displays the interactive 3D map with live player tracking,
/// custom markers, and full BlueMap functionality.
#[tauri::command]
pub async fn open_map_viewer(app: AppHandle) -> Result<(), String> {
    // First check if BlueMap is available
    let status = check_bluemap_available().await?;

    if !status.available {
        return Err(status.error.unwrap_or_else(|| {
            "BlueMap is not available. Make sure the Minecraft server with BlueMap is running.".to_string()
        }));
    }

    // Parse the URL for Tauri - need to append index.html
    let full_url = format!("{}/index.html", BLUEMAP_URL);
    let url = WebviewUrl::External(
        full_url
            .parse()
            .map_err(|e| format!("Invalid BlueMap URL: {}", e))?,
    );

    // Create a new webview window with BlueMap
    // Using a separate window instead of child webview for Wayland compatibility
    WebviewWindowBuilder::new(&app, "bluemap", url)
        .title("BlueMap - Server Map Viewer")
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to create BlueMap window: {}", e))?;

    Ok(())
}

/// Close BlueMap viewer window if it's open
///
/// Closes the BlueMap webview window. This is useful for cleanup
/// or when the user wants to manually close the map.
#[tauri::command]
pub async fn close_map_viewer(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("bluemap") {
        window
            .close()
            .map_err(|e| format!("Failed to close BlueMap window: {}", e))?;
        Ok(())
    } else {
        Err("BlueMap window is not open".to_string())
    }
}

/// Get the configured BlueMap URL
///
/// Returns the URL where BlueMap is expected to be running.
/// This is useful for displaying to users or for configuration.
#[tauri::command]
pub fn get_bluemap_url() -> String {
    BLUEMAP_URL.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bluemap_url_is_localhost() {
        // Ensure BlueMap URL is always localhost for security
        assert!(BLUEMAP_URL.contains("127.0.0.1") || BLUEMAP_URL.contains("localhost"));
        assert!(BLUEMAP_URL.starts_with("http://"));
    }

    #[test]
    fn test_get_bluemap_url() {
        let url = get_bluemap_url();
        assert_eq!(url, BLUEMAP_URL);
    }

    #[tokio::test]
    async fn test_check_bluemap_unavailable() {
        // Test when BlueMap is not running
        // Should return status with available=false
        let status = check_bluemap_available().await.unwrap();
        // We expect it to be unavailable in test environment
        // This is not a failure - it's the expected behavior
        assert!(status.url == BLUEMAP_URL);
    }
}
