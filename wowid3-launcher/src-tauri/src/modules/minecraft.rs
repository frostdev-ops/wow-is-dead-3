use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::{Child, Command};

use super::game_installer::get_installed_version;
use super::library_manager;
use super::minecraft_version::{Argument, ArgumentValue};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub ram_mb: u32,
    pub java_path: Option<PathBuf>,
    pub game_dir: PathBuf,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
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

    // Build classpath
    let libraries_dir = game_dir.join("libraries");
    let client_jar = game_dir
        .join("versions")
        .join(&version_meta.id)
        .join(format!("{}.jar", version_meta.id));

    let features = HashMap::new();
    let classpath = library_manager::build_classpath(
        &version_meta.libraries,
        &libraries_dir,
        &client_jar,
        &features,
    )?;

    // Prepare argument substitution map
    let mut arg_map = HashMap::new();
    arg_map.insert("auth_player_name".to_string(), config.username.clone());
    arg_map.insert("version_name".to_string(), version_meta.id.clone());
    arg_map.insert("game_directory".to_string(), game_dir.display().to_string());
    arg_map.insert("assets_root".to_string(), game_dir.join("assets").display().to_string());
    arg_map.insert("assets_index_name".to_string(), version_meta.asset_index.id.clone());
    arg_map.insert("auth_uuid".to_string(), config.uuid.clone());
    arg_map.insert("auth_access_token".to_string(), config.access_token.clone());
    arg_map.insert("user_type".to_string(), "msa".to_string());
    arg_map.insert("version_type".to_string(), version_meta.version_type.clone());
    arg_map.insert("natives_directory".to_string(), game_dir.join("natives").display().to_string());
    arg_map.insert("launcher_name".to_string(), "wowid3-launcher".to_string());
    arg_map.insert("launcher_version".to_string(), "1.0.0".to_string());
    arg_map.insert("classpath".to_string(), classpath.clone());

    // Build JVM arguments
    let mut jvm_args = vec![
        format!("-Xmx{}M", config.ram_mb),
        format!("-Xms{}M", config.ram_mb / 2),
        "-XX:+UseG1GC".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:G1NewSizePercent=20".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:MaxGCPauseMillis=50".to_string(),
        "-XX:G1HeapRegionSize=32M".to_string(),
    ];

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

    // Construct command
    let mut cmd = Command::new(&java_path);

    // Add JVM arguments
    for arg in jvm_args {
        cmd.arg(arg);
    }

    // Add main class
    cmd.arg(&version_meta.main_class);

    // Add game arguments
    for arg in game_args {
        cmd.arg(arg);
    }

    // Set working directory
    cmd.current_dir(&game_dir);

    // Capture stdout/stderr for log streaming
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let child = cmd
        .spawn()
        .context("Failed to spawn Minecraft process")?;

    Ok(child)
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
