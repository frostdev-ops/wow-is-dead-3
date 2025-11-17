mod modules;

use modules::auth::{authenticate_minecraft, authenticate_from_official_launcher, get_current_user, logout, refresh_token, get_device_code, complete_device_code_auth, MinecraftProfile, DeviceCodeInfo};
use modules::discord::{DiscordClient, GamePresence};
use modules::minecraft::{launch_game, LaunchConfig};
use modules::server::{ping_server, ServerStatus};
use modules::updater::{check_for_updates, get_installed_version, install_modpack, Manifest};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

// Authentication Commands
#[tauri::command]
async fn cmd_authenticate() -> Result<MinecraftProfile, String> {
    authenticate_minecraft()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_authenticate_official_launcher() -> Result<MinecraftProfile, String> {
    authenticate_from_official_launcher()
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

#[tauri::command]
async fn cmd_get_device_code() -> Result<DeviceCodeInfo, String> {
    get_device_code()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_complete_device_code_auth(device_code: String, interval: u64) -> Result<MinecraftProfile, String> {
    complete_device_code_auth(device_code, interval)
        .await
        .map_err(|e| e.to_string())
}

// Minecraft Launch Commands
#[tauri::command]
async fn cmd_launch_game(config: LaunchConfig) -> Result<String, String> {
    launch_game(config)
        .await
        .map(|_| "Game launched successfully".to_string())
        .map_err(|e| e.to_string())
}

// Discord Rich Presence Commands
#[tauri::command]
async fn cmd_discord_connect(discord: State<'_, DiscordClient>) -> Result<(), String> {
    discord.connect().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_set_presence(
    discord: State<'_, DiscordClient>,
    presence: GamePresence,
) -> Result<(), String> {
    discord.set_presence(&presence).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_update_presence(
    discord: State<'_, DiscordClient>,
    presence: GamePresence,
) -> Result<(), String> {
    discord.update_presence(&presence).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_clear_presence(discord: State<'_, DiscordClient>) -> Result<(), String> {
    discord.clear_presence().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_disconnect(discord: State<'_, DiscordClient>) -> Result<(), String> {
    discord.disconnect().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_is_connected(discord: State<'_, DiscordClient>) -> Result<bool, String> {
    Ok(discord.is_connected().await)
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
        .manage(DiscordClient::new())
        .invoke_handler(tauri::generate_handler![
            cmd_authenticate,
            cmd_authenticate_official_launcher,
            cmd_get_current_user,
            cmd_refresh_token,
            cmd_logout,
            cmd_get_device_code,
            cmd_complete_device_code_auth,
            cmd_launch_game,
            cmd_ping_server,
            cmd_check_updates,
            cmd_get_installed_version,
            cmd_install_modpack,
            cmd_discord_connect,
            cmd_discord_set_presence,
            cmd_discord_update_presence,
            cmd_discord_clear_presence,
            cmd_discord_disconnect,
            cmd_discord_is_connected,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
