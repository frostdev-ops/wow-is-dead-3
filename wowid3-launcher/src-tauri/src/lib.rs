mod modules;

use modules::auth::{authenticate_minecraft, get_current_user, logout, refresh_token, MinecraftProfile};
use modules::minecraft::{launch_game, LaunchConfig};
use modules::server::{ping_server, ServerStatus};
use modules::updater::{check_for_updates, get_installed_version, install_modpack, Manifest};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

// Authentication Commands
#[tauri::command]
async fn cmd_authenticate() -> Result<MinecraftProfile, String> {
    authenticate_minecraft()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_get_current_user() -> Result<Option<MinecraftProfile>, String> {
    get_current_user().map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_refresh_token() -> Result<MinecraftProfile, String> {
    refresh_token()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_logout() -> Result<(), String> {
    logout().map_err(|e| e.to_string())
}

// Minecraft Launch Commands
#[tauri::command]
async fn cmd_launch_game(config: LaunchConfig) -> Result<String, String> {
    launch_game(config)
        .await
        .map(|_| "Game launched successfully".to_string())
        .map_err(|e| e.to_string())
}

// Server Status Commands
#[tauri::command]
async fn cmd_ping_server(address: String) -> Result<ServerStatus, String> {
    ping_server(&address).await.map_err(|e| e.to_string())
}

// Download progress event payload
#[derive(Clone, Serialize)]
struct DownloadProgressEvent {
    current: usize,
    total: usize,
    filename: String,
}

// Modpack Update Commands
#[tauri::command]
async fn cmd_check_updates(manifest_url: String) -> Result<Manifest, String> {
    check_for_updates(&manifest_url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_installed_version(game_dir: PathBuf) -> Result<Option<String>, String> {
    get_installed_version(&game_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_install_modpack(
    app: AppHandle,
    manifest: Manifest,
    game_dir: PathBuf,
) -> Result<String, String> {
    install_modpack(&manifest, &game_dir, move |current, total, filename| {
        let progress = DownloadProgressEvent { current, total, filename };
        let _ = app.emit("download-progress", progress);
    })
    .await
    .map(|_| "Modpack installed successfully".to_string())
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            cmd_authenticate,
            cmd_get_current_user,
            cmd_refresh_token,
            cmd_logout,
            cmd_launch_game,
            cmd_ping_server,
            cmd_check_updates,
            cmd_get_installed_version,
            cmd_install_modpack,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
