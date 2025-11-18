use anyhow::{Context, Result};
use std::path::PathBuf;
use tauri::Manager;

/// Get the default game directory path for the current OS
///
/// - Windows: %LOCALAPPDATA%\wowid3-launcher\game
/// - Linux: ~/.local/share/wowid3-launcher/game
/// - macOS: ~/Library/Application Support/wowid3-launcher/game
pub fn get_default_game_directory(app: &tauri::AppHandle) -> Result<PathBuf> {
    let app_data_dir = app
        .path()
        .app_local_data_dir()
        .context("Failed to get app local data directory")?;

    let game_dir = app_data_dir.join("game");

    Ok(game_dir)
}

/// Resolve a game directory path to an absolute path
///
/// If the path is already absolute, return it as-is.
/// If it's relative, resolve it relative to the app local data directory.
pub fn resolve_game_directory(app: &tauri::AppHandle, path: &PathBuf) -> Result<PathBuf> {
    if path.is_absolute() {
        Ok(path.clone())
    } else {
        // Relative paths are resolved relative to app local data dir
        let app_data_dir = app
            .path()
            .app_local_data_dir()
            .context("Failed to get app local data directory")?;

        Ok(app_data_dir.join(path))
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
