use anyhow::{Context, Result};
use std::path::PathBuf;
use tauri::Manager;

/// Get the default game directory path for the current OS
///
/// Uses explicit home directory resolution to avoid AppImage sandbox issues.
/// - Windows: %USERPROFILE%\.wowid3\game
/// - Linux: $HOME/.wowid3/game (or $XDG_DATA_HOME/wowid3-launcher/game if XDG_DATA_HOME is set)
/// - macOS: ~/Library/Application Support/wowid3-launcher/game
pub fn get_default_game_directory(_app: &tauri::AppHandle) -> Result<PathBuf> {
    // Use explicit home directory to avoid AppImage temp path issues
    let base_dir = get_persistent_data_dir()?;
    let game_dir = base_dir.join("game");

    // Debug logging for path resolution (especially helpful for AppImage debugging)
    #[cfg(debug_assertions)]
    {
        eprintln!("[Paths] Base directory: {:?}", base_dir);
        eprintln!("[Paths] Game directory: {:?}", game_dir);
    }

    // In release mode, log only if RUST_LOG is set
    #[cfg(not(debug_assertions))]
    {
        if std::env::var("RUST_LOG").is_ok() {
            eprintln!("[Paths] Base directory: {:?}", base_dir);
            eprintln!("[Paths] Game directory: {:?}", game_dir);
        }
    }

    Ok(game_dir)
}

/// Get the persistent data directory that works across all environments (including AppImage)
///
/// This function explicitly uses HOME or XDG_DATA_HOME to avoid AppImage sandbox temp directories.
///
/// Returns:
/// - Linux: $HOME/.wowid3 (or $XDG_DATA_HOME/wowid3-launcher if XDG_DATA_HOME is set)
/// - macOS: ~/Library/Application Support/wowid3-launcher
/// - Windows: %USERPROFILE%\.wowid3
pub fn get_persistent_data_dir() -> Result<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        // On Linux, prefer XDG_DATA_HOME if set, otherwise use HOME
        if let Ok(xdg_data) = std::env::var("XDG_DATA_HOME") {
            let path = PathBuf::from(xdg_data).join("wowid3-launcher");
            return Ok(path);
        }

        if let Ok(home) = std::env::var("HOME") {
            // Use ~/.wowid3 for simpler path
            let path = PathBuf::from(home).join(".wowid3");
            return Ok(path);
        }

        anyhow::bail!("Could not determine home directory (HOME not set)");
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let path = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("wowid3-launcher");
            return Ok(path);
        }

        anyhow::bail!("Could not determine home directory (HOME not set)");
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let path = PathBuf::from(userprofile).join(".wowid3");
            return Ok(path);
        }

        if let Ok(homepath) = std::env::var("HOMEPATH") {
            if let Ok(homedrive) = std::env::var("HOMEDRIVE") {
                let path = PathBuf::from(format!("{}{}", homedrive, homepath)).join(".wowid3");
                return Ok(path);
            }
        }

        anyhow::bail!("Could not determine user profile directory");
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        anyhow::bail!("Unsupported operating system");
    }
}

/// Resolve a game directory path to an absolute path
///
/// If the path is already absolute, return it as-is.
/// If it's relative, resolve it relative to the persistent data directory.
pub fn resolve_game_directory(_app: &tauri::AppHandle, path: &PathBuf) -> Result<PathBuf> {
    if path.is_absolute() {
        Ok(path.clone())
    } else {
        // Relative paths are resolved relative to persistent data dir
        let base_dir = get_persistent_data_dir()?;
        Ok(base_dir.join(path))
    }
}

/// Validate that a game directory path is safe to use
///
/// Checks:
/// - Path is not empty
/// - Path doesn't contain dangerous patterns
/// - Parent directory exists or can be created
pub fn validate_game_directory(path: &PathBuf) -> Result<()> {
    // Check path is not empty
    if path.as_os_str().is_empty() {
        anyhow::bail!("Game directory path cannot be empty");
    }

    // Check for dangerous patterns (e.g., system directories)
    let path_str = path.to_string_lossy();

    #[cfg(target_os = "windows")]
    {
        let dangerous = ["C:\\Windows", "C:\\Program Files", "C:\\ProgramData"];
        if dangerous.iter().any(|d| path_str.starts_with(d)) {
            anyhow::bail!("Cannot use system directory for game files");
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let dangerous = ["/bin", "/sbin", "/usr", "/etc", "/var", "/sys", "/proc"];
        if dangerous.iter().any(|d| path_str.starts_with(d)) {
            anyhow::bail!("Cannot use system directory for game files");
        }
    }

    // Check parent directory exists or can be created
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .context("Failed to create parent directory")?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_dangerous_paths() {
        #[cfg(target_os = "windows")]
        {
            let path = PathBuf::from("C:\\Windows\\game");
            assert!(validate_game_directory(&path).is_err());
        }

        #[cfg(not(target_os = "windows"))]
        {
            let path = PathBuf::from("/usr/game");
            assert!(validate_game_directory(&path).is_err());
        }
    }

    #[test]
    fn test_validate_empty_path() {
        let path = PathBuf::from("");
        assert!(validate_game_directory(&path).is_err());
    }
}
