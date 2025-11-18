use std::fs::File;
use std::io::{BufRead, BufReader, Result as IoResult};
use std::path::PathBuf;

/// Read the last N lines from the Minecraft latest.log file
pub fn read_latest_log(game_dir: &str, lines: usize) -> IoResult<Vec<String>> {
    let log_path = PathBuf::from(game_dir)
        .join("logs")
        .join("latest.log");

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_path)?;
    let reader = BufReader::new(file);

    // Read all lines and keep only the last N
    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(|line| line.ok())
        .collect();

    let start_idx = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };

    Ok(all_lines[start_idx..].to_vec())
}

/// Get the path to the latest.log file
pub fn get_log_path(game_dir: &str) -> PathBuf {
    PathBuf::from(game_dir)
        .join("logs")
        .join("latest.log")
}

/// Watch the log file for changes and return new lines
/// This is a simple implementation that reads the entire file
/// A production version might use a file watching library
pub fn get_new_log_lines(
    game_dir: &str,
    known_line_count: usize,
) -> IoResult<Vec<String>> {
    let log_path = get_log_path(game_dir);

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_path)?;
    let reader = BufReader::new(file);

    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(|line| line.ok())
        .collect();

    if all_lines.len() > known_line_count {
        Ok(all_lines[known_line_count..].to_vec())
    } else {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_read_latest_log_nonexistent() {
        let result = read_latest_log("/nonexistent/path", 10);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_read_latest_log_with_file() {
        let temp_dir = TempDir::new().unwrap();
        let log_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        let log_file = log_dir.join("latest.log");
        fs::write(
            &log_file,
            "[00:00:00] [main/INFO]: Starting up\n\
             [00:00:01] [main/INFO]: Loading config\n\
             [00:00:02] [main/INFO]: Done loading\n",
        )
        .unwrap();

        let lines = read_latest_log(temp_dir.path().to_str().unwrap(), 10).unwrap();
        assert_eq!(lines.len(), 3);
        assert!(lines[0].contains("Starting up"));
    }

    #[test]
    fn test_read_latest_log_limit() {
        let temp_dir = TempDir::new().unwrap();
        let log_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        let log_file = log_dir.join("latest.log");
        let mut content = String::new();
        for i in 0..100 {
            content.push_str(&format!("[00:00:{:02}] [main/INFO]: Line {}\n", i % 60, i));
        }
        fs::write(&log_file, content).unwrap();

        let lines = read_latest_log(temp_dir.path().to_str().unwrap(), 10).unwrap();
        assert_eq!(lines.len(), 10);
        assert!(lines[0].contains("Line 90"));
        assert!(lines[9].contains("Line 99"));
    }

    #[test]
    fn test_get_new_log_lines() {
        let temp_dir = TempDir::new().unwrap();
        let log_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();

        let log_file = log_dir.join("latest.log");
        fs::write(&log_file, "[00:00:00] [main/INFO]: Line 0\n").unwrap();

        let new_lines =
            get_new_log_lines(temp_dir.path().to_str().unwrap(), 0).unwrap();
        assert_eq!(new_lines.len(), 1);

        // Simulate appending new lines
        fs::write(
            &log_file,
            "[00:00:00] [main/INFO]: Line 0\n\
             [00:00:01] [main/INFO]: Line 1\n\
             [00:00:02] [main/INFO]: Line 2\n",
        )
        .unwrap();

        let new_lines =
            get_new_log_lines(temp_dir.path().to_str().unwrap(), 1).unwrap();
        assert_eq!(new_lines.len(), 2);
        assert!(new_lines[0].contains("Line 1"));
    }
}
