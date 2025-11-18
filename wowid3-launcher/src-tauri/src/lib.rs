mod modules;

use modules::auth::{authenticate_from_official_launcher, get_current_user, logout, refresh_token, get_device_code, complete_device_code_auth, MinecraftProfile, DeviceCodeInfo};
use modules::discord::{DiscordClient, GamePresence};
use modules::minecraft::{launch_game, launch_game_with_metadata, analyze_crash, LaunchConfig, stop_game, kill_game, is_game_running};
use modules::minecraft_version::{list_versions, get_latest_release, get_latest_snapshot, VersionInfo};
use modules::fabric_installer::{get_fabric_loaders, get_latest_fabric_loader, FabricLoader};
use modules::game_installer::{install_minecraft, is_version_installed, InstallConfig};
use modules::server::{ping_server, ServerStatus};
use modules::updater::{check_for_updates, get_installed_version, install_modpack, Manifest};
use modules::audio::{get_cached_audio, download_and_cache_audio, read_cached_audio_bytes, clear_audio_cache};
use modules::java_runtime::{get_cached_java, download_and_cache_java};
use modules::logger::initialize_logger;
use modules::log_reader::{read_latest_log, get_log_path, get_new_log_lines};
use modules::paths::{get_default_game_directory, resolve_game_directory, validate_game_directory};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

// Authentication Commands
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
    eprintln!("[Tauri Command] cmd_complete_device_code_auth called with device_code length: {}, interval: {}", device_code.len(), interval);

    let result = complete_device_code_auth(device_code, interval).await;

    match &result {
        Ok(profile) => {
            eprintln!("[Tauri Command] Authentication successful for user: {}", profile.username);
            eprintln!("[Tauri Command] Returning profile to React...");
        }
        Err(e) => {
            eprintln!("[Tauri Command] Authentication failed with error: {}", e);
        }
    }

    result.map_err(|e| e.to_string())
}

// Minecraft Launch Commands
#[tauri::command]
async fn cmd_launch_game(app: AppHandle, mut config: LaunchConfig) -> Result<String, String> {
    // Resolve game directory if it's relative and doesn't exist in current dir
    if config.game_dir.is_relative() {
        // Check if it exists relative to current directory first
        if !config.game_dir.exists() {
            // If not, resolve to app data directory
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                config.game_dir = app_data_dir.join(&config.game_dir);
                eprintln!("[Launcher] Resolved game directory to: {:?}", config.game_dir);
            }
        } else {
            eprintln!("[Launcher] Using existing game directory: {:?}", config.game_dir);
        }
    }

    // Store game_dir for crash analysis
    let game_dir = config.game_dir.clone();

    // Resolve Java path if not set - use downloaded runtime
    if config.java_path.is_none() {
        // Try to get cached Java first
        match get_cached_java(&app).await {
            Ok(Some(java_path)) => {
                config.java_path = Some(java_path);
            }
            Ok(None) => {
                // Download Java from release server
                eprintln!("[Launcher] Java not cached, downloading from release server...");
                let java_url = "https://wowid-launcher.frostdev.io/api/java";
                match download_and_cache_java(&app, java_url.to_string()).await {
                    Ok(java_path) => {
                        config.java_path = Some(java_path);
                    }
                    Err(e) => {
                        return Err(format!("Failed to download Java runtime: {}", e));
                    }
                }
            }
            Err(e) => {
                return Err(format!("Failed to check for cached Java: {}", e));
            }
        }
    }

    // Launch the game process
    let mut process = launch_game(config)
        .await
        .map_err(|e| e.to_string())?;

    // Take stdout and stderr for streaming
    let stdout = process.stdout.take();
    let stderr = process.stderr.take();

    // Spawn task to stream stdout
    if let Some(stdout) = stdout {
        let app_stdout = app.clone();
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_stdout.emit("minecraft-log", serde_json::json!({
                    "level": "info",
                    "message": line
                }));
            }
        });
    }

    // Spawn task to stream stderr
    if let Some(stderr) = stderr {
        let app_stderr = app.clone();
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let is_error = line.contains("ERROR") ||
                              line.contains("Exception") ||
                              line.contains("FATAL");

                let _ = app_stderr.emit("minecraft-log", serde_json::json!({
                    "level": if is_error { "error" } else { "warn" },
                    "message": line
                }));
            }
        });
    }

    // Spawn task to monitor process exit
    let app_monitor = app.clone();
    tokio::spawn(async move {
        match process.wait().await {
            Ok(status) => {
                let exit_code = status.code().unwrap_or(-1);
                let crashed = exit_code != 0;

                let _ = app_monitor.emit("minecraft-exit", serde_json::json!({
                    "exit_code": exit_code,
                    "crashed": crashed
                }));

                // If crashed, analyze crash report
                if crashed {
                    if let Ok(crash_msg) = analyze_crash(&game_dir).await {
                        let _ = app_monitor.emit("minecraft-crash", serde_json::json!({
                            "message": crash_msg
                        }));
                    }
                }
            }
            Err(e) => {
                eprintln!("Error waiting for process: {}", e);
            }
        }
    });

    Ok("Game launched successfully".to_string())
}

#[tauri::command]
async fn cmd_launch_game_with_metadata(
    app: AppHandle,
    mut config: LaunchConfig,
    version_id: String,
) -> Result<String, String> {
    // Resolve game directory if it's relative and doesn't exist in current dir
    if config.game_dir.is_relative() {
        // Check if it exists relative to current directory first
        if !config.game_dir.exists() {
            // If not, resolve to app data directory
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                config.game_dir = app_data_dir.join(&config.game_dir);
                eprintln!("[Launcher] Resolved game directory to: {:?}", config.game_dir);
            }
        } else {
            eprintln!("[Launcher] Using existing game directory: {:?}", config.game_dir);
        }
    }

    // Store game_dir for crash analysis
    let game_dir = config.game_dir.clone();

    // Resolve Java path if not set - use downloaded runtime
    if config.java_path.is_none() {
        // Try to get cached Java first
        match get_cached_java(&app).await {
            Ok(Some(java_path)) => {
                config.java_path = Some(java_path);
            }
            Ok(None) => {
                // Download Java from release server
                eprintln!("[Launcher] Java not cached, downloading from release server...");
                let java_url = "https://wowid-launcher.frostdev.io/api/java";
                match download_and_cache_java(&app, java_url.to_string()).await {
                    Ok(java_path) => {
                        config.java_path = Some(java_path);
                    }
                    Err(e) => {
                        return Err(format!("Failed to download Java runtime: {}", e));
                    }
                }
            }
            Err(e) => {
                return Err(format!("Failed to check for cached Java: {}", e));
            }
        }
    }

    // Launch the game process
    let mut process = launch_game_with_metadata(config, &version_id)
        .await
        .map_err(|e| e.to_string())?;

    // Take stdout and stderr for streaming (same as cmd_launch_game)
    let stdout = process.stdout.take();
    let stderr = process.stderr.take();

    if let Some(stdout) = stdout {
        let app_stdout = app.clone();
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_stdout.emit("minecraft-log", serde_json::json!({
                    "level": "info",
                    "message": line
                }));
            }
        });
    }

    if let Some(stderr) = stderr {
        let app_stderr = app.clone();
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let is_error = line.contains("ERROR") ||
                              line.contains("Exception") ||
                              line.contains("FATAL");

                let _ = app_stderr.emit("minecraft-log", serde_json::json!({
                    "level": if is_error { "error" } else { "warn" },
                    "message": line
                }));
            }
        });
    }

    let app_monitor = app.clone();
    tokio::spawn(async move {
        match process.wait().await {
            Ok(status) => {
                let exit_code = status.code().unwrap_or(-1);
                let crashed = exit_code != 0;

                let _ = app_monitor.emit("minecraft-exit", serde_json::json!({
                    "exit_code": exit_code,
                    "crashed": crashed
                }));

                if crashed {
                    if let Ok(crash_msg) = analyze_crash(&game_dir).await {
                        let _ = app_monitor.emit("minecraft-crash", serde_json::json!({
                            "message": crash_msg
                        }));
                    }
                }
            }
            Err(e) => {
                eprintln!("Error waiting for process: {}", e);
            }
        }
    });

    Ok("Game launched successfully".to_string())
}

// Minecraft Version Commands
#[tauri::command]
async fn cmd_list_minecraft_versions(version_type: Option<String>) -> Result<Vec<VersionInfo>, String> {
    list_versions(version_type.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_latest_release() -> Result<String, String> {
    get_latest_release()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_latest_snapshot() -> Result<String, String> {
    get_latest_snapshot()
        .await
        .map_err(|e| e.to_string())
}

// Fabric Commands
#[tauri::command]
async fn cmd_get_fabric_loaders(game_version: String) -> Result<Vec<FabricLoader>, String> {
    get_fabric_loaders(&game_version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_latest_fabric_loader(game_version: String) -> Result<FabricLoader, String> {
    get_latest_fabric_loader(&game_version)
        .await
        .map_err(|e| e.to_string())
}

// Minecraft Installation Commands
#[tauri::command]
async fn cmd_install_minecraft(
    app: AppHandle,
    config: InstallConfig,
) -> Result<String, String> {
    install_minecraft(config, move |progress| {
        let _ = app.emit("minecraft-install-progress", progress);
    })
    .await
    .map(|_| "Installation complete".to_string())
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_is_version_installed(
    game_dir: PathBuf,
    version_id: String,
) -> Result<bool, String> {
    is_version_installed(&game_dir, &version_id)
        .await
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
    details: String,
    state: String,
    large_image: Option<String>,
) -> Result<(), String> {
    let presence = GamePresence {
        state,
        details: Some(details),
        large_image,
        large_image_text: None,
        small_image: None,
        small_image_text: None,
        start_time: Some(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64),
        end_time: None,
        player_count: None,
    };
    discord.set_presence(&presence).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_discord_update_presence(
    discord: State<'_, DiscordClient>,
    details: String,
    state: String,
) -> Result<(), String> {
    let presence = GamePresence {
        state,
        details: Some(details),
        large_image: Some("minecraft".to_string()),
        large_image_text: None,
        small_image: None,
        small_image_text: None,
        start_time: None, // Keep existing start time
        end_time: None,
        player_count: None,
    };
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
    current: usize,      // Current file number (1-indexed)
    total: usize,        // Total files
    filename: String,    // Current file being downloaded
    current_bytes: u64,  // Bytes downloaded so far
    total_bytes: u64,    // Total bytes to download
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
    install_modpack(&manifest, &game_dir, move |current, total, filename, current_bytes, total_bytes| {
        let progress = DownloadProgressEvent {
            current,
            total,
            filename,
            current_bytes,
            total_bytes,
        };
        let _ = app.emit("download-progress", progress);
    })
    .await
    .map(|_| "Modpack installed successfully".to_string())
    .map_err(|e| e.to_string())
}

// Audio Commands
#[tauri::command]
async fn cmd_get_cached_audio(app: AppHandle) -> Result<Option<String>, String> {
    get_cached_audio(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_download_and_cache_audio(app: AppHandle, url: String) -> Result<String, String> {
    download_and_cache_audio(&app, url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_read_cached_audio_bytes(app: AppHandle) -> Result<Option<Vec<u8>>, String> {
    read_cached_audio_bytes(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_clear_audio_cache(app: AppHandle) -> Result<(), String> {
    clear_audio_cache(&app)
        .await
        .map_err(|e| e.to_string())
}

// Game Control Commands
#[tauri::command]
async fn cmd_stop_game() -> Result<(), String> {
    stop_game()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_kill_game() -> Result<(), String> {
    kill_game()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_is_game_running() -> bool {
    is_game_running().await
}

// Log Reading Commands
#[tauri::command]
fn cmd_read_latest_log(game_dir: String, lines: usize) -> Result<Vec<String>, String> {
    read_latest_log(&game_dir, lines)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_get_log_path(game_dir: String) -> String {
    get_log_path(&game_dir)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn cmd_get_new_log_lines(game_dir: String, known_line_count: usize) -> Result<Vec<String>, String> {
    get_new_log_lines(&game_dir, known_line_count)
        .map_err(|e| e.to_string())
}

// Path Management Commands
#[tauri::command]
fn cmd_get_default_game_directory(app: AppHandle) -> Result<String, String> {
    get_default_game_directory(&app)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_resolve_game_directory(app: AppHandle, path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(path);
    resolve_game_directory(&app, &path_buf)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_validate_game_directory(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    validate_game_directory(&path_buf)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger on startup
    initialize_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .manage(DiscordClient::new())
        .invoke_handler(tauri::generate_handler![
            cmd_authenticate_official_launcher,
            cmd_get_current_user,
            cmd_refresh_token,
            cmd_logout,
            cmd_get_device_code,
            cmd_complete_device_code_auth,
            cmd_launch_game,
            cmd_launch_game_with_metadata,
            cmd_list_minecraft_versions,
            cmd_get_latest_release,
            cmd_get_latest_snapshot,
            cmd_get_fabric_loaders,
            cmd_get_latest_fabric_loader,
            cmd_install_minecraft,
            cmd_is_version_installed,
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
            cmd_get_cached_audio,
            cmd_download_and_cache_audio,
            cmd_read_cached_audio_bytes,
            cmd_clear_audio_cache,
            cmd_stop_game,
            cmd_kill_game,
            cmd_is_game_running,
            cmd_read_latest_log,
            cmd_get_log_path,
            cmd_get_new_log_lines,
            cmd_get_default_game_directory,
            cmd_resolve_game_directory,
            cmd_validate_game_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
