use std::fs::File;
use std::io::{BufRead, BufReader, Read, Result as IoResult, Seek, SeekFrom};
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct LogResult {
    pub lines: Vec<String>,
    pub start_offset: u64,
    pub end_offset: u64,
    pub total_size: u64,
}

/// Get the path to the latest.log file
pub fn get_log_path(game_dir: &str) -> PathBuf {
    PathBuf::from(game_dir)
        .join("logs")
        .join("latest.log")
}

/// Read the last N lines from the Minecraft latest.log file
/// Returns the lines, start offset (byte position of first line), end offset (file size), and total size
pub fn read_log_tail(game_dir: &str, lines: usize) -> IoResult<LogResult> {
    let log_path = get_log_path(game_dir);

    if !log_path.exists() {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: 0,
            end_offset: 0,
            total_size: 0,
        });
    }

    let mut file = File::open(&log_path)?;
    let total_size = file.metadata()?.len();
    
    if total_size == 0 {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: 0,
            end_offset: 0,
            total_size: 0,
        });
    }

    // If file is small enough, just read it all
    // 100KB is a reasonable threshold where reading all is fast enough
    // However, for consistency with offset calculation and to avoid ownership issues,
    // we use the reverse reader for all file sizes.
    // The reverse reader is efficient enough for small files too.

    // Efficient reverse reading
    let mut result_lines = Vec::new();
    let mut position = total_size;
    let mut lines_found = 0;
    let chunk_size = 4096; // 4KB chunks
    let mut buffer = vec![0u8; chunk_size];
    
    // Keep track of where the last line ended (for the next line we find going backwards)
    let mut last_line_end = total_size;

    while position > 0 && lines_found < lines {
        let read_size = std::cmp::min(position, chunk_size as u64);
        position -= read_size;
        
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut buffer[0..read_size as usize])?;
        
        // Scan backwards in the buffer
        for i in (0..read_size as usize).rev() {
            if buffer[i] == b'\n' {
                // Found a newline
                // The line starts at position + i + 1
                let line_start = position + i as u64 + 1;
                
                // If this is not the very end of the file (or we haven't processed the last partial line)
                if line_start < last_line_end {
                    file.seek(SeekFrom::Start(line_start))?;
                    let mut line_buf = vec![0u8; (last_line_end - line_start) as usize];
                    file.read_exact(&mut line_buf)?;
                    
                    if let Ok(line) = String::from_utf8(line_buf) {
                        // Trim CR if present
                        let line = if line.ends_with('\r') {
                            line[..line.len()-1].to_string()
                        } else {
                            line
                        };
                        result_lines.push(line);
                        lines_found += 1;
                        
                        if lines_found >= lines {
                            break;
                        }
                    }
                }
                
                last_line_end = position + i as u64;
            }
        }
    }
    
    // Handle the first line of the file (if we reached start)
    if position == 0 && lines_found < lines && last_line_end > 0 {
        file.seek(SeekFrom::Start(0))?;
        let mut line_buf = vec![0u8; last_line_end as usize];
        file.read_exact(&mut line_buf)?;
        
        if let Ok(line) = String::from_utf8(line_buf) {
             // Trim CR/LF if present (though we read to last_line_end which was a \n)
            let line = line.trim_end().to_string();
            result_lines.push(line);
        }
    }
    
    // Reverse lines to get correct order
    result_lines.reverse();
    
    // Calculate start offset
    // If we found all lines, the start offset is the start of the first line we found
    // If we reached start of file, it's 0
    // Otherwise, the start offset is the position after the newline before the first line we included
    let start_offset = if position == 0 && lines_found < lines {
        0
    } else {
        // We stopped at a newline, so the first line starts after it
        // The loop updates `last_line_end` to the position of the newline found.
        // When we finish, `last_line_end` points to the newline BEFORE the first line we included.
        // So the start offset of the lines we collected is `last_line_end + 1`.
        last_line_end + 1
    };

    Ok(LogResult {
        lines: result_lines,
        start_offset,
        end_offset: total_size,
        total_size,
    })
}

/// Read new log lines starting from a specific offset
pub fn read_log_from_offset(game_dir: &str, start_offset: u64) -> IoResult<LogResult> {
    let log_path = get_log_path(game_dir);

    if !log_path.exists() {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: 0,
            end_offset: 0,
            total_size: 0,
        });
    }

    let mut file = File::open(&log_path)?;
    let total_size = file.metadata()?.len();
    
    if start_offset >= total_size {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: total_size,
            end_offset: total_size,
            total_size,
        });
    }

    file.seek(SeekFrom::Start(start_offset))?;
    
    let mut content = String::new();
    file.read_to_string(&mut content)?;
    
    let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    
    Ok(LogResult {
        lines,
        start_offset,
        end_offset: total_size,
        total_size,
    })
}

/// Read N lines ending at a specific offset (scrolling up)
pub fn read_log_before_offset(game_dir: &str, end_offset: u64, lines: usize) -> IoResult<LogResult> {
    let log_path = get_log_path(game_dir);

    if !log_path.exists() {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: 0,
            end_offset: 0,
            total_size: 0,
        });
    }

    let mut file = File::open(&log_path)?;
    let total_size = file.metadata()?.len();
    
    // Clamp end_offset
    let end_offset = std::cmp::min(end_offset, total_size);
    
    if end_offset == 0 {
        return Ok(LogResult {
            lines: Vec::new(),
            start_offset: 0,
            end_offset: 0,
            total_size,
        });
    }

    // Efficient reverse reading starting from end_offset
    let mut result_lines = Vec::new();
    let mut position = end_offset;
    let mut lines_found = 0;
    let chunk_size = 4096;
    let mut buffer = vec![0u8; chunk_size];
    
    let mut last_line_end = end_offset;

    while position > 0 && lines_found < lines {
        let read_size = std::cmp::min(position, chunk_size as u64);
        position -= read_size;
        
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut buffer[0..read_size as usize])?;
        
        for i in (0..read_size as usize).rev() {
            if buffer[i] == b'\n' {
                let line_start = position + i as u64 + 1;
                
                if line_start < last_line_end {
                    file.seek(SeekFrom::Start(line_start))?;
                    let mut line_buf = vec![0u8; (last_line_end - line_start) as usize];
                    file.read_exact(&mut line_buf)?;
                    
                    if let Ok(line) = String::from_utf8(line_buf) {
                        let line = if line.ends_with('\r') {
                            line[..line.len()-1].to_string()
                        } else {
                            line
                        };
                        result_lines.push(line);
                        lines_found += 1;
                        
                        if lines_found >= lines {
                            break;
                        }
                    }
                }
                
                last_line_end = position + i as u64;
            }
        }
    }
    
    if position == 0 && lines_found < lines && last_line_end > 0 {
        file.seek(SeekFrom::Start(0))?;
        let mut line_buf = vec![0u8; last_line_end as usize];
        file.read_exact(&mut line_buf)?;
        
        if let Ok(line) = String::from_utf8(line_buf) {
            let line = line.trim_end().to_string();
            result_lines.push(line);
        }
    }
    
    result_lines.reverse();
    
    let start_offset = if position == 0 && lines_found < lines {
        0
    } else {
        last_line_end + 1
    };

    Ok(LogResult {
        lines: result_lines,
        start_offset,
        end_offset, // We return the requested end_offset as the end of this chunk
        total_size,
    })
}

// Deprecated functions kept for compatibility if needed, but we'll remove them from lib.rs
pub fn read_latest_log(game_dir: &str, lines: usize) -> IoResult<Vec<String>> {
    let result = read_log_tail(game_dir, lines)?;
    Ok(result.lines)
}

pub fn get_new_log_lines(
    game_dir: &str,
    known_line_count: usize,
) -> IoResult<Vec<String>> {
    // This old function is hard to map to offsets without reading everything.
    // We'll implement a fallback that reads everything, which is what it did before.
    let log_path = get_log_path(game_dir);
    if !log_path.exists() {
        return Ok(Vec::new());
    }
    
    let file = File::open(&log_path)?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    
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
    fn test_read_log_tail() {
        let temp_dir = TempDir::new().unwrap();
        let log_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();
        let log_file = log_dir.join("latest.log");
        
        let mut content = String::new();
        for i in 0..10 {
            content.push_str(&format!("Line {}\n", i));
        }
        fs::write(&log_file, content).unwrap();
        
        let result = read_log_tail(temp_dir.path().to_str().unwrap(), 5).unwrap();
        assert_eq!(result.lines.len(), 5);
        assert_eq!(result.lines[0], "Line 5");
        assert_eq!(result.lines[4], "Line 9");
    }
    
    #[test]
    fn test_read_log_from_offset() {
        let temp_dir = TempDir::new().unwrap();
        let log_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();
        let log_file = log_dir.join("latest.log");
        
        fs::write(&log_file, "Line 1\nLine 2\n").unwrap();
        
        // Read first part to get offset
        let result1 = read_log_tail(temp_dir.path().to_str().unwrap(), 10).unwrap();
        let end_offset = result1.end_offset;
        
        // Append
        let mut file = fs::OpenOptions::new().append(true).open(&log_file).unwrap();
        use std::io::Write;
        writeln!(file, "Line 3").unwrap();
        
        let result2 = read_log_from_offset(temp_dir.path().to_str().unwrap(), end_offset).unwrap();
        assert_eq!(result2.lines.len(), 1);
        assert_eq!(result2.lines[0], "Line 3");
    }
}
