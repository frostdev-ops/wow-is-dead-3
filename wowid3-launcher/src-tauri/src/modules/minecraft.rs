use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Child, Command};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub ram_mb: u32,
    pub java_path: Option<PathBuf>,
    pub game_dir: PathBuf,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
}

/// Launch Minecraft with the specified configuration
pub async fn launch_game(config: LaunchConfig) -> Result<Child> {
    let java_path = config
        .java_path
        .unwrap_or_else(|| get_bundled_java_path());

    // Construct Minecraft launch command
    let mut cmd = Command::new(java_path);

    cmd.arg(format!("-Xmx{}M", config.ram_mb))
        .arg(format!("-Xms{}M", config.ram_mb))
        .arg("-Djava.library.path=./natives")
        .arg("-cp")
        .arg("./libraries/*:./minecraft.jar")
        .arg("net.fabricmc.loader.impl.launch.knot.KnotClient")
        .arg("--accessToken")
        .arg(&config.access_token)
        .arg("--uuid")
        .arg(&config.uuid)
        .arg("--username")
        .arg(&config.username)
        .arg("--version")
        .arg("1.20.1")
        .arg("--gameDir")
        .arg(&config.game_dir)
        .arg("--assetsDir")
        .arg("./assets");

    let child = cmd.spawn()?;

    Ok(child)
}

/// Get path to bundled Java runtime
fn get_bundled_java_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        PathBuf::from("./runtime/java/bin/java.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("./runtime/java/bin/java")
    }
}

/// Kill running Minecraft process
pub fn kill_game(mut process: Child) -> Result<()> {
    process.kill()?;
    Ok(())
}

/// Get real-time log stream from Minecraft
pub async fn get_log_stream(log_path: PathBuf) -> Result<()> {
    // TODO: Implement log streaming
    // Use tokio::fs::File to tail the log file
    // Emit events to frontend with log lines

    todo!("Implement log streaming")
}
