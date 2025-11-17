use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

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

    // Verify Java exists
    if !java_path.exists() {
        return Err(anyhow::anyhow!(
            "Java runtime not found at {:?}. Please ensure Java is installed or the bundled JVM is present.",
            java_path
        ));
    }

    // Get platform-specific classpath separator
    let classpath_sep = get_classpath_separator();

    // Build classpath
    let game_dir = &config.game_dir;
    let classpath = format!(
        "{}{}libraries{}*{}{}minecraft.jar",
        game_dir.display(),
        std::path::MAIN_SEPARATOR,
        std::path::MAIN_SEPARATOR,
        classpath_sep,
        game_dir.display()
    );

    // Construct Minecraft launch command
    let mut cmd = Command::new(&java_path);

    // JVM arguments
    cmd.arg(format!("-Xmx{}M", config.ram_mb))
        .arg(format!("-Xms{}M", config.ram_mb))
        .arg("-XX:+UseG1GC") // Use G1 garbage collector for better performance
        .arg("-XX:+UnlockExperimentalVMOptions")
        .arg("-XX:G1NewSizePercent=20")
        .arg("-XX:G1ReservePercent=20")
        .arg("-XX:MaxGCPauseMillis=50")
        .arg("-XX:G1HeapRegionSize=32M")
        .arg(format!(
            "-Djava.library.path={}/natives",
            game_dir.display()
        ))
        .arg("-cp")
        .arg(&classpath);

    // Main class (Fabric Loader)
    cmd.arg("net.fabricmc.loader.impl.launch.knot.KnotClient");

    // Game arguments
    cmd.arg("--accessToken")
        .arg(&config.access_token)
        .arg("--uuid")
        .arg(&config.uuid)
        .arg("--username")
        .arg(&config.username)
        .arg("--version")
        .arg("fabric-loader-0.15.0-1.20.1") // This should be configurable
        .arg("--gameDir")
        .arg(&config.game_dir)
        .arg("--assetsDir")
        .arg(format!("{}/assets", game_dir.display()))
        .arg("--assetIndex")
        .arg("1.20");

    // Set working directory
    cmd.current_dir(&config.game_dir);

    // Capture stdout/stderr for log streaming
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let child = cmd
        .spawn()
        .context("Failed to spawn Minecraft process")?;

    Ok(child)
}

/// Get platform-specific classpath separator
fn get_classpath_separator() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        ";"
    }

    #[cfg(not(target_os = "windows"))]
    {
        ":"
    }
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
pub async fn kill_game(mut process: Child) -> Result<()> {
    process.kill().await?;
    Ok(())
}

/// Stream Minecraft process output to frontend
pub async fn stream_process_output(
    mut process: tokio::process::Child,
    app_handle: AppHandle,
) -> Result<()> {
    // Take stdout and stderr
    let stdout = process
        .stdout
        .take()
        .context("Failed to capture stdout")?;
    let stderr = process
        .stderr
        .take()
        .context("Failed to capture stderr")?;

    let app_handle_clone = app_handle.clone();

    // Spawn task to stream stdout
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_handle_clone.emit("minecraft-log", LogEvent {
                level: "info".to_string(),
                message: line,
            });
        }
    });

    // Spawn task to stream stderr
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            // Check for crash indicators
            let is_error = line.contains("ERROR") ||
                          line.contains("Exception") ||
                          line.contains("FATAL");

            let _ = app_handle.emit("minecraft-log", LogEvent {
                level: if is_error { "error" } else { "warn" }.to_string(),
                message: line,
            });
        }
    });

    Ok(())
}

/// Monitor Minecraft process and emit status events
pub async fn monitor_process(
    mut process: tokio::process::Child,
    app_handle: AppHandle,
) -> Result<i32> {
    // Wait for process to exit
    let status = process
        .wait()
        .await
        .context("Failed to wait for process")?;

    let exit_code = status.code().unwrap_or(-1);

    // Emit process exit event
    let _ = app_handle.emit("minecraft-exit", ProcessExitEvent {
        exit_code,
        crashed: exit_code != 0,
    });

    Ok(exit_code)
}

/// Event emitted for Minecraft log lines
#[derive(Debug, Clone, Serialize)]
pub struct LogEvent {
    pub level: String,
    pub message: String,
}

/// Event emitted when Minecraft process exits
#[derive(Debug, Clone, Serialize)]
pub struct ProcessExitEvent {
    pub exit_code: i32,
    pub crashed: bool,
}

/// Analyze crash report and return helpful error message
pub async fn analyze_crash(game_dir: &PathBuf) -> Result<String> {
    let crash_reports_dir = game_dir.join("crash-reports");

    if !crash_reports_dir.exists() {
        return Ok("No crash reports found. The game may have exited normally.".to_string());
    }

    // Find the most recent crash report
    let mut entries = tokio::fs::read_dir(&crash_reports_dir)
        .await
        .context("Failed to read crash-reports directory")?;

    let mut latest_crash: Option<(PathBuf, std::time::SystemTime)> = None;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("txt") {
            if let Ok(metadata) = entry.metadata().await {
                if let Ok(modified) = metadata.modified() {
                    if latest_crash.is_none() || modified > latest_crash.as_ref().unwrap().1 {
                        latest_crash = Some((path, modified));
                    }
                }
            }
        }
    }

    if let Some((crash_path, _)) = latest_crash {
        let crash_content = tokio::fs::read_to_string(&crash_path)
            .await
            .context("Failed to read crash report")?;

        // Extract key information from crash report
        let mut error_msg = String::from("Minecraft crashed. ");

        // Look for common error patterns
        if crash_content.contains("OutOfMemoryError") {
            error_msg.push_str("Cause: Out of memory. Try allocating more RAM in settings.");
        } else if crash_content.contains("java.lang.NoClassDefFoundError") {
            error_msg.push_str("Cause: Missing or incompatible mod. Check your mods.");
        } else if crash_content.contains("Mod ") && crash_content.contains("requires") {
            error_msg.push_str("Cause: Missing mod dependency. Check mod requirements.");
        } else {
            error_msg.push_str(&format!(
                "See crash report at: {}",
                crash_path.display()
            ));
        }

        Ok(error_msg)
    } else {
        Ok("Crash occurred but no crash report was generated.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_bundled_java_path_windows() {
        #[cfg(target_os = "windows")]
        {
            let path = get_bundled_java_path();
            assert_eq!(path, PathBuf::from("./runtime/java/bin/java.exe"));
        }
    }

    #[test]
    fn test_get_bundled_java_path_unix() {
        #[cfg(not(target_os = "windows"))]
        {
            let path = get_bundled_java_path();
            assert_eq!(path, PathBuf::from("./runtime/java/bin/java"));
        }
    }

    #[test]
    fn test_classpath_separator_windows() {
        #[cfg(target_os = "windows")]
        {
            assert_eq!(get_classpath_separator(), ";");
        }
    }

    #[test]
    fn test_classpath_separator_unix() {
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(get_classpath_separator(), ":");
        }
    }

    #[test]
    fn test_launch_config_serialization() {
        let config = LaunchConfig {
            ram_mb: 4096,
            java_path: Some(PathBuf::from("/usr/bin/java")),
            game_dir: PathBuf::from("/home/user/.minecraft"),
            username: "TestUser".to_string(),
            uuid: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            access_token: "test_token".to_string(),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("TestUser"));
        assert!(json.contains("4096"));
    }

    #[tokio::test]
    async fn test_analyze_crash_no_reports() {
        let temp_dir = std::env::temp_dir().join("test_minecraft_no_crash");
        std::fs::create_dir_all(&temp_dir).ok();

        let result = analyze_crash(&temp_dir).await.unwrap();
        assert!(result.contains("No crash reports found"));

        std::fs::remove_dir_all(&temp_dir).ok();
    }

    #[tokio::test]
    async fn test_analyze_crash_with_oom() {
        let temp_dir = std::env::temp_dir().join("test_minecraft_oom");
        let crash_dir = temp_dir.join("crash-reports");
        std::fs::create_dir_all(&crash_dir).ok();

        let crash_content = "Exception in thread \"main\" java.lang.OutOfMemoryError: Java heap space";
        let crash_file = crash_dir.join("crash-2024-01-01-12-00-00.txt");
        std::fs::write(&crash_file, crash_content).ok();

        let result = analyze_crash(&temp_dir).await.unwrap();
        assert!(result.contains("Out of memory"));
        assert!(result.contains("RAM"));

        std::fs::remove_dir_all(&temp_dir).ok();
    }
}
