use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const LOG_DIR_NAME: &str = "wowid3-launcher";
const LOG_FILE_NAME: &str = "auth.log";
const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES: usize = 7; // Keep 7 days worth

fn get_log_dir() -> Result<PathBuf, anyhow::Error> {
    if let Some(data_dir) = dirs::data_local_dir() {
        let log_dir = data_dir.join(LOG_DIR_NAME);
        fs::create_dir_all(&log_dir)?;
        Ok(log_dir)
    } else {
        Err(anyhow::anyhow!("Could not determine data directory"))
    }
}

fn get_log_path() -> Result<PathBuf, anyhow::Error> {
    let log_dir = get_log_dir()?;
    Ok(log_dir.join(LOG_FILE_NAME))
}

fn rotate_logs() -> Result<(), anyhow::Error> {
    let log_dir = get_log_dir()?;
    let log_path = log_dir.join(LOG_FILE_NAME);

    // Check if current log file exists and is too large
    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() > MAX_LOG_SIZE {
            let timestamp = Local::now().format("%Y%m%d_%H%M%S");
            let rotated_name = format!("auth_{}.log", timestamp);
            let rotated_path = log_dir.join(&rotated_name);

            if let Err(e) = fs::rename(&log_path, &rotated_path) {
                eprintln!("[Logger] Failed to rotate log: {}", e);
            }
        }
    }

    // Clean up old log files
    if let Ok(entries) = fs::read_dir(&log_dir) {
        let mut log_files: Vec<_> = entries
            .filter_map(|entry| {
                entry.ok().and_then(|e| {
                    let name = e.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with("auth_") && name_str.ends_with(".log") {
                        Some(e.path())
                    } else {
                        None
                    }
                })
            })
            .collect();

        // Sort by modification time, keep newest
        log_files.sort_by_key(|path| {
            fs::metadata(path)
                .and_then(|m| m.modified())
                .unwrap_or_else(|_| std::time::SystemTime::now())
        });

        // Remove oldest files if we have too many
        while log_files.len() > MAX_LOG_FILES {
            if let Some(oldest) = log_files.first() {
                let _ = fs::remove_file(oldest);
                log_files.remove(0);
            }
        }
    }

    Ok(())
}

pub fn log_auth(operation: &str, details: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let message = format!("[{}] AUTH: {} - {}", timestamp, operation, details);

    // Always log to stderr (visible in dev console)
    eprintln!("{}", message);

    // Try to log to file
    if let Ok(log_path) = get_log_path() {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "{}", message);
        }
    }
}

pub fn log_storage(operation: &str, storage_type: &str, success: bool, details: &str) {
    let status = if success { "✓" } else { "✗" };
    let operation_str = format!("{} ({})", operation, storage_type);
    let message = format!("{} {} - {}", status, operation_str, details);
    log_auth(&message, "");
}

pub fn initialize_logger() {
    log_auth("INIT", "Logger initialized");

    // Try to rotate logs on startup
    if let Err(e) = rotate_logs() {
        eprintln!("[Logger] Failed to rotate logs: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_auth() {
        log_auth("TEST", "This is a test message");
        // Just ensure it doesn't panic
    }

    #[test]
    fn test_log_storage() {
        log_storage("SAVE", "keyring", true, "Profile saved successfully");
        log_storage("LOAD", "encrypted_file", false, "File not found");
    }
}
