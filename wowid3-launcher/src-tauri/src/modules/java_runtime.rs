use anyhow::{Context, Result};
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tauri::Manager;

const MAX_DOWNLOAD_RETRIES: u32 = 3;
const RETRY_DELAY_MS: u64 = 2000;
const JAVA_CACHE_DIR: &str = "cache/java";

/// Platform-specific Java runtime info
#[derive(Debug, Clone)]
pub struct JavaRuntimeInfo {
    pub url: String,
    pub executable_path: String, // Relative path within the extracted archive to the java executable
}

/// Get the appropriate Java runtime URL for the current platform
fn get_java_runtime_info(base_url: &str) -> Result<JavaRuntimeInfo> {
    let (filename, exe_path) = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => (
            "zulu21-windows-x64.zip",
            "zulu21.46.19-ca-jdk21.0.9-win_x64/bin/javaw.exe"
        ),
        ("macos", "x86_64") => (
            "zulu21-macos-x64.tar.gz",
            "zulu21.46.19-ca-jdk21.0.9-macosx_x64/zulu-21.jdk/Contents/Home/bin/java"
        ),
        ("macos", "aarch64") => (
            "zulu21-macos-aarch64.tar.gz",
            "zulu21.46.19-ca-jdk21.0.9-macosx_aarch64/zulu-21.jdk/Contents/Home/bin/java"
        ),
        ("linux", "x86_64") => (
            "zulu21-linux-x64.tar.gz",
            "zulu21.46.19-ca-jdk21.0.9-linux_x64/bin/java"
        ),
        (os, arch) => {
            anyhow::bail!("Unsupported platform: {} {}", os, arch);
        }
    };

    Ok(JavaRuntimeInfo {
        url: format!("{}/{}", base_url, filename),
        executable_path: exe_path.to_string(),
    })
}

/// Get the cache directory for Java runtime
fn get_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .context("Failed to get app cache directory")?
        .join(JAVA_CACHE_DIR);

    Ok(cache_dir)
}

/// Check if Java runtime is already cached and return path to executable
pub async fn get_cached_java(app_handle: &tauri::AppHandle) -> Result<Option<PathBuf>> {
    let cache_dir = get_cache_dir(app_handle)?;

    // Get the platform-specific executable path
    let runtime_info = get_java_runtime_info("")?; // Base URL not needed for path lookup
    let java_exe = cache_dir.join(&runtime_info.executable_path);

    if java_exe.exists() {
        eprintln!("[Java] Found cached Java at: {}", java_exe.display());

        // Verify it's executable
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&java_exe)
                .await
                .context("Failed to read Java executable metadata")?;
            let permissions = metadata.permissions();

            if permissions.mode() & 0o111 == 0 {
                eprintln!("[Java] Java executable lacks execute permissions, setting them...");
                let mut new_permissions = permissions.clone();
                new_permissions.set_mode(permissions.mode() | 0o111);
                fs::set_permissions(&java_exe, new_permissions)
                    .await
                    .context("Failed to set execute permissions")?;
            }
        }

        return Ok(Some(java_exe));
    }

    eprintln!("[Java] No cached Java runtime found");
    Ok(None)
}

/// Download and extract Java runtime with retry logic
pub async fn download_and_cache_java(
    app_handle: &tauri::AppHandle,
    base_url: String,
) -> Result<PathBuf> {
    let runtime_info = get_java_runtime_info(&base_url)?;

    eprintln!("[Java] Starting download from: {}", runtime_info.url);
    eprintln!("[Java] Platform: {} {}", std::env::consts::OS, std::env::consts::ARCH);

    let cache_dir = get_cache_dir(app_handle)?;
    fs::create_dir_all(&cache_dir)
        .await
        .context("Failed to create Java cache directory")?;

    let archive_name = runtime_info.url.split('/').last().unwrap();
    let archive_file = cache_dir.join(archive_name);
    let temp_file = cache_dir.join(format!("{}.tmp", archive_name));

    // Try downloading with retries
    let mut retries = 0;
    loop {
        match download_file(&runtime_info.url, &temp_file).await {
            Ok(file_size) => {
                eprintln!("[Java] Download successful: {} bytes", file_size);

                // Move temp file to final location
                fs::rename(&temp_file, &archive_file)
                    .await
                    .context("Failed to move archive file")?;

                // Extract the archive
                extract_java_archive(&archive_file, &cache_dir).await?;

                // Remove archive file to save space
                let _ = fs::remove_file(&archive_file).await;

                // Get path to executable
                let java_exe = cache_dir.join(&runtime_info.executable_path);

                if !java_exe.exists() {
                    anyhow::bail!("Java executable not found after extraction: {}", java_exe.display());
                }

                // Set execute permissions on Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let metadata = fs::metadata(&java_exe)
                        .await
                        .context("Failed to read Java executable metadata")?;
                    let mut permissions = metadata.permissions();
                    permissions.set_mode(permissions.mode() | 0o111);
                    fs::set_permissions(&java_exe, permissions)
                        .await
                        .context("Failed to set execute permissions")?;
                }

                eprintln!("[Java] Java runtime ready at: {}", java_exe.display());
                return Ok(java_exe);
            }
            Err(e) => {
                retries += 1;
                if retries >= MAX_DOWNLOAD_RETRIES {
                    let _ = fs::remove_file(&temp_file).await;
                    let _ = fs::remove_file(&archive_file).await;
                    eprintln!("[Java] Download failed after {} retries: {}", MAX_DOWNLOAD_RETRIES, e);
                    return Err(e).context(format!(
                        "Failed to download Java runtime after {} retries",
                        MAX_DOWNLOAD_RETRIES
                    ));
                }

                let delay_ms = RETRY_DELAY_MS * retries as u64;
                eprintln!(
                    "[Java] Download failed (attempt {}/{}): {}. Retrying in {}ms...",
                    retries, MAX_DOWNLOAD_RETRIES, e, delay_ms
                );

                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
        }
    }
}

/// Download file from URL
async fn download_file(url: &str, output_path: &PathBuf) -> Result<u64> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300)) // 5 minutes for large Java runtime
        .build()
        .context("Failed to create HTTP client")?;

    let response = client
        .get(url)
        .send()
        .await
        .context(format!("Failed to download from {}", url))?;

    if !response.status().is_success() {
        anyhow::bail!(
            "Download failed with HTTP status {}: {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown error")
        );
    }

    let bytes = response
        .bytes()
        .await
        .context("Failed to read response bytes")?;

    let file_size = bytes.len() as u64;

    // Create parent directories if they don't exist
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create parent directories")?;
    }

    // Write to file
    let mut f = fs::File::create(output_path)
        .await
        .context("Failed to create file")?;

    f.write_all(&bytes)
        .await
        .context("Failed to write file contents")?;

    f.flush()
        .await
        .context("Failed to flush file")?;

    f.sync_all()
        .await
        .context("Failed to sync file to disk")?;

    Ok(file_size)
}

/// Extract Java archive (tar.gz or zip)
async fn extract_java_archive(archive_path: &PathBuf, extract_to: &PathBuf) -> Result<()> {
    eprintln!("[Java] Extracting archive: {}", archive_path.display());

    let archive_name = archive_path.file_name()
        .and_then(|n| n.to_str())
        .context("Invalid archive filename")?;

    if archive_name.ends_with(".tar.gz") {
        // Extract tar.gz using tokio task to avoid blocking
        let archive_path = archive_path.clone();
        let extract_to = extract_to.clone();

        tokio::task::spawn_blocking(move || {
            use flate2::read::GzDecoder;
            use tar::Archive;
            use std::fs::File;

            let tar_gz = File::open(&archive_path)
                .context("Failed to open tar.gz file")?;
            let tar = GzDecoder::new(tar_gz);
            let mut archive = Archive::new(tar);
            archive.unpack(&extract_to)
                .context("Failed to extract tar.gz archive")?;

            Ok::<(), anyhow::Error>(())
        })
        .await
        .context("Extraction task panicked")??;

    } else if archive_name.ends_with(".zip") {
        // Extract zip using tokio task
        let archive_path = archive_path.clone();
        let extract_to = extract_to.clone();

        tokio::task::spawn_blocking(move || {
            use zip::ZipArchive;
            use std::fs::File;
            use std::io::copy;

            let file = File::open(&archive_path)
                .context("Failed to open zip file")?;
            let mut archive = ZipArchive::new(file)
                .context("Failed to read zip archive")?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)
                    .context("Failed to get file from archive")?;
                let outpath = extract_to.join(file.name());

                if file.is_dir() {
                    std::fs::create_dir_all(&outpath)
                        .context("Failed to create directory")?;
                } else {
                    if let Some(parent) = outpath.parent() {
                        std::fs::create_dir_all(parent)
                            .context("Failed to create parent directory")?;
                    }
                    let mut outfile = File::create(&outpath)
                        .context("Failed to create output file")?;
                    copy(&mut file, &mut outfile)
                        .context("Failed to copy file contents")?;

                    // Set permissions on Unix
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        if let Some(mode) = file.unix_mode() {
                            let permissions = std::fs::Permissions::from_mode(mode);
                            std::fs::set_permissions(&outpath, permissions)
                                .context("Failed to set file permissions")?;
                        }
                    }
                }
            }

            Ok::<(), anyhow::Error>(())
        })
        .await
        .context("Extraction task panicked")??;
    } else {
        anyhow::bail!("Unsupported archive format: {}", archive_name);
    }

    eprintln!("[Java] Extraction complete");
    Ok(())
}

/// Clear Java runtime cache (for testing/troubleshooting)
#[allow(dead_code)]
pub async fn clear_java_cache(app_handle: &tauri::AppHandle) -> Result<()> {
    let cache_dir = get_cache_dir(app_handle)?;

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .await
            .context("Failed to remove Java cache directory")?;
        eprintln!("[Java] Cache cleared: {}", cache_dir.display());
    }

    Ok(())
}
