use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use sysinfo::{System, Pid, ProcessesToUpdate};

use super::game_installer::get_installed_version;
use super::library_manager;
use super::minecraft_version::{Argument, ArgumentValue};
use super::auth::get_access_token_by_session_id;
use super::updater::get_installed_version as get_modpack_version;

#[cfg(target_os = "windows")]
use super::vpn::VpnManager;

// Global game process ID tracker
lazy_static::lazy_static! {
    pub static ref GAME_PROCESS_ID: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(None));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub ram_mb: u32,
    pub java_path: Option<PathBuf>,
    pub game_dir: PathBuf,
    pub username: String,
    pub uuid: String,
    pub session_id: String, // Session ID for token lookup
}

/// Launch Minecraft with version metadata (new system)
pub async fn launch_game_with_metadata(
    config: LaunchConfig,
    version_id: &str,
) -> Result<Child> {
    let game_dir = &config.game_dir;

    // Load version metadata
    let version_meta = get_installed_version(game_dir, version_id)
        .await
        .context("Failed to load version metadata")?;

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

    // Build classpath with relative paths (since working directory will be game_dir)
    let libraries_dir = PathBuf::from("libraries");
    let client_jar = PathBuf::from("versions")
        .join(&version_meta.id)
        .join(format!("{}.jar", version_meta.id));

    let features = HashMap::new();
    let classpath = library_manager::build_classpath(
        &version_meta.libraries,
        &libraries_dir,
        &client_jar,
        game_dir,
        &features,
    )?;

    // Lookup access token from session_id
    let access_token = get_access_token_by_session_id(&config.session_id)
        .context("Failed to retrieve access token from session_id")?;

    // Prepare argument substitution map
    // Note: Since working directory will be set to game_dir, use relative paths
    let mut arg_map = HashMap::new();
    arg_map.insert("auth_player_name".to_string(), config.username.clone());
    arg_map.insert("version_name".to_string(), version_meta.id.clone());
    arg_map.insert("game_directory".to_string(), ".".to_string()); // Current directory since cwd = game_dir
    arg_map.insert("assets_root".to_string(), "assets".to_string()); // Relative to game_dir
    arg_map.insert("assets_index_name".to_string(), version_meta.asset_index.id.clone());
    arg_map.insert("auth_uuid".to_string(), config.uuid.clone());
    arg_map.insert("auth_access_token".to_string(), access_token);
    arg_map.insert("user_type".to_string(), "msa".to_string());
    arg_map.insert("version_type".to_string(), version_meta.version_type.clone());
    arg_map.insert("natives_directory".to_string(), "natives".to_string()); // Relative to game_dir
    arg_map.insert("launcher_name".to_string(), "wowid3-launcher".to_string());
    arg_map.insert("launcher_version".to_string(), "1.0.0".to_string());
    arg_map.insert("classpath".to_string(), classpath.clone());

    // Build JVM arguments with optimized GC settings
    let mut jvm_args = vec![
        format!("-Xmx{}M", config.ram_mb),
        format!("-Xms{}M", config.ram_mb),
        // G1GC optimizations
        "-XX:+UseG1GC".to_string(),
        "-XX:+ParallelRefProcEnabled".to_string(),
        "-XX:MaxGCPauseMillis=200".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+DisableExplicitGC".to_string(),
        "-XX:G1NewSizePercent=30".to_string(),
        "-XX:G1MaxNewSizePercent=40".to_string(),
        "-XX:G1HeapRegionSize=8M".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:G1HeapWastePercent=5".to_string(),
        "-XX:G1MixedGCCountTarget=4".to_string(),
        "-XX:InitiatingHeapOccupancyPercent=15".to_string(),
        "-XX:G1MixedGCLiveThresholdPercent=90".to_string(),
        "-XX:G1RSetUpdatingPauseTimePercent=5".to_string(),
        "-XX:SurvivorRatio=32".to_string(),
        "-XX:+PerfDisableSharedMem".to_string(),
        "-XX:MaxTenuringThreshold=1".to_string(),
        // Minecraft-specific optimizations
        "-Dorg.lwjgl.opengl.Display.allowSoftwareOpenGL=true".to_string(),
        "-Dfml.earlyprogresswindow=false".to_string(),
    ];

    // Platform-specific optimizations
    #[cfg(target_os = "linux")]
    {
        if is_wayland_session() {
            // Use the patched glfw-wayland-minecraft-cursorfix library for native Wayland support
            jvm_args.push("-Dorg.lwjgl.glfw.libname=/usr/lib/libglfw.so.3".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows-specific optimizations
        jvm_args.push("-XX:+AlwaysPreTouch".to_string()); // Pre-touch memory pages for better performance
        jvm_args.push("-XX:+UseStringDeduplication".to_string()); // Reduce memory usage
    }

    #[cfg(target_os = "macos")]
    {
        // macOS-specific optimizations
        jvm_args.push("-XstartOnFirstThread".to_string()); // Required for LWJGL on macOS
        jvm_args.push("-XX:+AlwaysPreTouch".to_string()); // Pre-touch memory pages
    }

    // Add Fabric-specific JVM argument if this is a Fabric loader
    if version_meta.main_class.contains("fabric") {
        // Normalize to forward slashes for cross-platform compatibility (Minecraft convention)
        let game_jar_path = client_jar.to_string_lossy().replace("\\", "/");
        jvm_args.push(format!("-Dfabric.gameJar={}", game_jar_path));
        eprintln!("[Fabric] Added gameJar argument: {}", game_jar_path);
    }

    // Add JVM arguments from version metadata
    if let Some(arguments) = &version_meta.arguments {
        for arg in &arguments.jvm {
            jvm_args.extend(resolve_argument(arg, &arg_map, &features));
        }
    } else {
        // Legacy format: add default JVM args
        jvm_args.push(format!("-Djava.library.path={}", arg_map.get("natives_directory").unwrap()));
        jvm_args.push("-cp".to_string());
        jvm_args.push(classpath.clone());
    }

    // Build game arguments
    let mut game_args = Vec::new();

    if let Some(arguments) = &version_meta.arguments {
        for arg in &arguments.game {
            game_args.extend(resolve_argument(arg, &arg_map, &features));
        }
    } else if let Some(minecraft_arguments) = &version_meta.minecraft_arguments {
        // Legacy format (pre-1.13)
        for arg in minecraft_arguments.split_whitespace() {
            game_args.push(substitute_argument(arg, &arg_map));
        }
    }

    // Log the command for debugging BEFORE consuming the args
    eprintln!("[Minecraft] Launching with Java: {:?}", java_path);
    eprintln!("[Minecraft] Working directory: {:?}", game_dir);
    eprintln!("[Minecraft] Main class: {}", version_meta.main_class);
    eprintln!("[Minecraft] Classpath (first 500 chars): {}", &classpath[..classpath.len().min(500)]);
    eprintln!("[Minecraft] JVM args count: {}", jvm_args.len());
    eprintln!("[Minecraft] First 5 JVM args: {:?}", &jvm_args[..jvm_args.len().min(5)]);

    // Find and log the -cp argument
    for (i, arg) in jvm_args.iter().enumerate() {
        if arg == "-cp" && i + 1 < jvm_args.len() {
            eprintln!("[Minecraft] Found -cp at index {}, next arg length: {}", i, jvm_args[i + 1].len());
            eprintln!("[Minecraft] Classpath starts with: {}", &jvm_args[i + 1][..jvm_args[i + 1].len().min(200)]);
            break;
        }
    }

    // Construct command
    let mut cmd = Command::new(&java_path);

    // Add JVM arguments
    for arg in &jvm_args {
        cmd.arg(arg);
    }

    // Add main class
    cmd.arg(&version_meta.main_class);

    // Add game arguments
    for arg in &game_args {
        cmd.arg(arg);
    }

    // Set working directory
    cmd.current_dir(&game_dir);

    // Platform-specific environment variables
    #[cfg(target_os = "linux")]
    {
        if is_wayland_session() {
            eprintln!("[Minecraft] Using patched GLFW library for native Wayland support");
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Force Windows to use dedicated GPU (NVIDIA/AMD) instead of integrated Intel graphics
        // This fixes "GLFW error 65542: WGL: The driver does not appear to support OpenGL"
        cmd.env("SHIM_MCCOMPAT", "0x800000001"); // Disable compatibility shims
        cmd.env("__GL_SYNC_TO_VBLANK", "0"); // Disable vsync for NVIDIA
        eprintln!("[Minecraft] Forcing dedicated GPU usage on Windows");
    }

    // Capture stdout/stderr for log streaming
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let child = cmd
        .spawn()
        .context("Failed to spawn Minecraft process")?;

    // Store the process ID for later control (kill/stop)
    if let Some(pid) = child.id() {
        let mut game_pid = GAME_PROCESS_ID.lock().await;
        *game_pid = Some(pid);
        eprintln!("[Minecraft] Started with PID: {}", pid);
    }

    Ok(child)
}

/// Stop the Minecraft game gracefully (on Unix) or forcefully (on Windows)
/// Note: Graceful shutdown via stdin is not possible with this approach
/// Consider implementing an RPC/IPC mechanism if graceful shutdown is critical
pub async fn stop_game() -> Result<()> {
    let mut game_pid = GAME_PROCESS_ID.lock().await;

    if let Some(pid) = *game_pid {
        #[cfg(unix)]
        {
            // On Unix, send SIGTERM for graceful shutdown
            use std::process::Command;
            let _ = Command::new("kill")
                .arg("-15") // SIGTERM
                .arg(pid.to_string())
                .output();
        }

        #[cfg(windows)]
        {
            // On Windows, forcefully terminate
            use std::process::Command;
            let _ = Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/F"])
                .output();
        }

        eprintln!("[Minecraft] Stop signal sent to PID: {}", pid);
    }

    *game_pid = None;
    Ok(())
}

/// Kill the Minecraft game forcefully
pub async fn kill_game() -> Result<()> {
    let mut game_pid = GAME_PROCESS_ID.lock().await;

    if let Some(pid) = *game_pid {
        #[cfg(unix)]
        {
            use std::process::Command;
            let _ = Command::new("kill")
                .arg("-9") // SIGKILL
                .arg(pid.to_string())
                .output();
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/F"])
                .output();
        }

        eprintln!("[Minecraft] Kill signal sent to PID: {}", pid);
        *game_pid = None;
    }

    Ok(())
}

/// Check if the game is currently running
pub async fn is_game_running() -> bool {
    let game_pid = GAME_PROCESS_ID.lock().await;

    if let Some(pid) = *game_pid {
        // Use sysinfo to check if process with this PID still exists
        // This works on both Windows and Unix, and avoids spawning terminal windows
        let mut system = System::new();
        let sysinfo_pid = Pid::from(pid as usize);
        // sysinfo 0.33+ uses refresh_processes instead of refresh_process
        // Refresh all processes to check if the specific PID exists
        system.refresh_processes(ProcessesToUpdate::All, true);
        system.process(sysinfo_pid).is_some()
    } else {
        false
    }
}

/// Resolve an argument (handles rules and variables)
fn resolve_argument(
    arg: &Argument,
    arg_map: &HashMap<String, String>,
    features: &HashMap<String, bool>,
) -> Vec<String> {
    match arg {
        Argument::String(s) => vec![substitute_argument(s, arg_map)],
        Argument::Object { rules, value } => {
            // Check if rules allow this argument
            if evaluate_argument_rules(rules, features) {
                match value {
                    ArgumentValue::String(s) => vec![substitute_argument(s, arg_map)],
                    ArgumentValue::Array(arr) => arr
                        .iter()
                        .map(|s| substitute_argument(s, arg_map))
                        .collect(),
                }
            } else {
                vec![]
            }
        }
    }
}

/// Evaluate argument rules
fn evaluate_argument_rules(
    rules: &[super::minecraft_version::Rule],
    features: &HashMap<String, bool>,
) -> bool {
    let mut allowed = false;

    for rule in rules {
        if library_manager::should_download_library(
            &super::minecraft_version::Library {
                name: String::new(),
                downloads: None,
                rules: Some(vec![rule.clone()]),
                natives: None,
                extract: None,
            },
            features,
        ) {
            allowed = rule.action == "allow";
        }
    }

    allowed
}

/// Substitute variables in an argument string
fn substitute_argument(arg: &str, arg_map: &HashMap<String, String>) -> String {
    let mut result = arg.to_string();

    for (key, value) in arg_map {
        let placeholder = format!("${{{}}}", key);
        result = result.replace(&placeholder, value);
    }

    result
}

/// Launch Minecraft with the specified configuration (legacy function)
pub async fn launch_game(config: LaunchConfig) -> Result<Child> {
    // Lookup access token from session_id
    let access_token = get_access_token_by_session_id(&config.session_id)
        .context("Failed to retrieve access token from session_id")?;

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
        .arg(&access_token)
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
        PathBuf::from("./runtime/java/bin/javaw.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("./runtime/java/bin/java")
    }
}

/// Detect if running on a Wayland session (Linux only)
#[cfg(target_os = "linux")]
fn is_wayland_session() -> bool {
    // Check common Wayland environment variables
    std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE").map(|v| v == "wayland").unwrap_or(false)
}

#[cfg(not(target_os = "linux"))]
fn is_wayland_session() -> bool {
    false
}

/// Verify if a server is reachable via TCP connection with 5-second timeout
pub async fn verify_server_reachable(address: &str) -> Result<bool> {
    use tokio::net::TcpStream;

    eprintln!("[Server Verification] Testing connection to: {}", address);

    match tokio::time::timeout(
        Duration::from_secs(5),
        TcpStream::connect(address)
    ).await {
        Ok(Ok(_stream)) => {
            eprintln!("[Server Verification] Successfully connected to {}", address);
            Ok(true)
        },
        Ok(Err(e)) => {
            eprintln!("[Server Verification] Failed to connect to {}: {}", address, e);
            Ok(false)
        },
        Err(_) => {
            eprintln!("[Server Verification] Timeout connecting to {}", address);
            Ok(false)
        }
    }
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
            assert_eq!(path, PathBuf::from("./runtime/java/bin/javaw.exe"));
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
            session_id: "test_session".to_string(),
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
