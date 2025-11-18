use anyhow::{Context, Result};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;
use zip::ZipArchive;

use super::download_manager::{DownloadManager, DownloadPriority, DownloadTask, HashType};
use super::minecraft_version::{Library, Rule};

/// Current OS name for rule evaluation
fn get_os_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
    #[cfg(target_os = "macos")]
    {
        "osx"
    }
}

/// Current architecture for rule evaluation
fn get_arch() -> &'static str {
    #[cfg(target_arch = "x86")]
    {
        "x86"
    }
    #[cfg(target_arch = "x86_64")]
    {
        "x86_64"
    }
    #[cfg(target_arch = "aarch64")]
    {
        "aarch64"
    }
}

/// Evaluate if a rule applies to the current system
fn evaluate_rule(rule: &Rule, features: &HashMap<String, bool>) -> bool {
    let action_allow = rule.action == "allow";

    // Check OS rule
    if let Some(os_rule) = &rule.os {
        if let Some(os_name) = &os_rule.name {
            let matches = os_name == get_os_name();
            if !matches {
                return !action_allow; // OS doesn't match, invert action
            }
        }

        if let Some(arch) = &os_rule.arch {
            let matches = arch == get_arch();
            if !matches {
                return !action_allow;
            }
        }
    }

    // Check feature rules
    if let Some(rule_features) = &rule.features {
        for (feature, required) in rule_features {
            let has_feature = features.get(feature).copied().unwrap_or(false);
            if has_feature != *required {
                return !action_allow;
            }
        }
    }

    action_allow
}

/// Check if a library should be downloaded for the current system
pub fn should_download_library(library: &Library, features: &HashMap<String, bool>) -> bool {
    if let Some(rules) = &library.rules {
        // Start with disallow by default if rules exist
        let mut allowed = false;

        for rule in rules {
            if evaluate_rule(rule, features) {
                allowed = rule.action == "allow";
            }
        }

        allowed
    } else {
        // No rules means always download
        true
    }
}

/// Convert Maven coordinates to file path
/// Example: "com.mojang:logging:1.0.0" -> "com/mojang/logging/1.0.0/logging-1.0.0.jar"
pub fn maven_to_path(maven: &str) -> String {
    let parts: Vec<&str> = maven.split(':').collect();
    if parts.len() != 3 {
        return maven.to_string();
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version)
}

/// Download a file with SHA1 verification
pub async fn download_file_verified(
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
) -> Result<()> {
    // Create parent directories
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    // Skip if file exists and matches hash
    if dest.exists() {
        if let Some(sha1) = expected_sha1 {
            if verify_sha1(dest, sha1).await? {
                return Ok(());
            }
        }
    }

    // Download file
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    let response = client
        .get(url)
        .send()
        .await
        .context(format!("Failed to download {}", url))?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to download {}: HTTP {}",
            url,
            response.status()
        ));
    }

    let bytes = response.bytes().await?;

    // Verify SHA1 if provided
    if let Some(expected) = expected_sha1 {
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let hash = format!("{:x}", hasher.finalize());

        if hash != expected {
            return Err(anyhow::anyhow!(
                "SHA1 mismatch for {}: expected {}, got {}",
                url,
                expected,
                hash
            ));
        }
    }

    // Write file
    let mut file = tokio::fs::File::create(dest).await?;
    file.write_all(&bytes).await?;

    Ok(())
}

/// Verify SHA1 hash of a file
pub async fn verify_sha1(path: &Path, expected: &str) -> Result<bool> {
    let bytes = tokio::fs::read(path).await?;
    let mut hasher = Sha1::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());
    Ok(hash == expected)
}


/// Download all libraries for a version using DownloadManager for parallel downloads
pub async fn download_all_libraries(
    libraries: &[Library],
    libraries_dir: &Path,
    features: &HashMap<String, bool>,
) -> Result<Vec<PathBuf>> {
    tokio::fs::create_dir_all(libraries_dir).await?;

    // Collect all download tasks upfront
    let mut download_tasks = Vec::new();
    let mut expected_paths = Vec::new();

    for library in libraries {
        if !should_download_library(library, features) {
            continue;
        }

        // Main artifact
        if let Some(downloads) = &library.downloads {
            if let Some(artifact) = &downloads.artifact {
                let dest = libraries_dir.join(&artifact.path);

                // Skip if already exists and hash matches
                if dest.exists() {
                    if let Ok(true) = verify_sha1(&dest, &artifact.sha1).await {
                        expected_paths.push(dest);
                        continue;
                    }
                }

                download_tasks.push(DownloadTask {
                    url: artifact.url.clone(),
                    dest: dest.clone(),
                    expected_hash: HashType::Sha1(artifact.sha1.clone()),
                    priority: DownloadPriority::High,
                    size: artifact.size,
                });
                expected_paths.push(dest);
            }

            // Native libraries
            if let Some(natives) = &library.natives {
                let os_name = get_os_name();
                if let Some(native_key) = natives.get(os_name) {
                    if let Some(classifiers) = &downloads.classifiers {
                        if let Some(native_artifact) = classifiers.get(native_key) {
                            let dest = libraries_dir.join(&native_artifact.path);

                            // Skip if already exists and hash matches
                            if dest.exists() {
                                if let Ok(true) = verify_sha1(&dest, &native_artifact.sha1).await {
                                    expected_paths.push(dest);
                                    continue;
                                }
                            }

                            download_tasks.push(DownloadTask {
                                url: native_artifact.url.clone(),
                                dest: dest.clone(),
                                expected_hash: HashType::Sha1(native_artifact.sha1.clone()),
                                priority: DownloadPriority::High,
                                size: native_artifact.size,
                            });
                            expected_paths.push(dest);
                        }
                    }
                }
            }
        }
    }

    // Download all files in parallel using DownloadManager
    if !download_tasks.is_empty() {
        let concurrency = super::download_manager::calculate_optimal_concurrency();
        let manager = DownloadManager::new(concurrency, 3)?;
        manager
            .download_files(download_tasks, None)
            .await
            .context("Failed to download libraries")?;
    }

    Ok(expected_paths)
}

/// Extract native libraries from JAR files
pub async fn extract_natives(
    libraries: &[Library],
    libraries_dir: &Path,
    natives_dir: &Path,
    features: &HashMap<String, bool>,
) -> Result<()> {
    tokio::fs::create_dir_all(natives_dir).await?;

    for library in libraries {
        if !should_download_library(library, features) {
            continue;
        }

        // Check if this is a native library
        if library.natives.is_some() {
            if let Some(downloads) = &library.downloads {
                let os_name = get_os_name();
                if let Some(native_key) = library.natives.as_ref().and_then(|n| n.get(os_name)) {
                    if let Some(classifiers) = &downloads.classifiers {
                        if let Some(native_artifact) = classifiers.get(native_key) {
                            let native_jar = libraries_dir.join(&native_artifact.path);

                            if native_jar.exists() {
                                extract_native_jar(&native_jar, natives_dir, &library.extract)
                                    .await?;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Extract a native JAR file
async fn extract_native_jar(
    jar_path: &Path,
    dest_dir: &Path,
    extract_rules: &Option<super::minecraft_version::Extract>,
) -> Result<()> {
    let file = std::fs::File::open(jar_path)?;
    let mut archive = ZipArchive::new(file)?;

    // Build exclusion list
    let mut exclusions = vec!["META-INF/".to_string()];
    if let Some(extract) = extract_rules {
        if let Some(exclude) = &extract.exclude {
            exclusions.extend(exclude.iter().cloned());
        }
    }

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();

        // Check exclusions
        let should_exclude = exclusions.iter().any(|ex| name.starts_with(ex));
        if should_exclude {
            continue;
        }

        let out_path = dest_dir.join(&name);

        if file.is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let mut out_file = std::fs::File::create(&out_path)?;
            std::io::copy(&mut file, &mut out_file)?;

            // Set executable permissions on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let perms = std::fs::Permissions::from_mode(0o755);
                std::fs::set_permissions(&out_path, perms)?;
            }
        }
    }

    Ok(())
}

/// Build classpath string from libraries
///
/// * `libraries_dir` - Relative path to libraries directory (e.g., "libraries")
/// * `client_jar` - Relative path to client JAR (e.g., "versions/...")
/// * `game_dir` - Absolute path to game directory for existence checks
pub fn build_classpath(
    libraries: &[Library],
    libraries_dir: &Path,
    client_jar: &Path,
    game_dir: &Path,
    features: &HashMap<String, bool>,
) -> Result<String> {
    let mut classpath_entries = Vec::new();

    // Add all library JARs
    for library in libraries {
        if !should_download_library(library, features) {
            continue;
        }

        // Build relative path for classpath
        let lib_relative_path = if let Some(downloads) = &library.downloads {
            // Use downloads path if available
            if let Some(artifact) = &downloads.artifact {
                libraries_dir.join(&artifact.path)
            } else {
                // Fallback to Maven coordinates
                libraries_dir.join(maven_to_path(&library.name))
            }
        } else {
            // No downloads info, construct from Maven coordinates
            libraries_dir.join(maven_to_path(&library.name))
        };

        // Check existence using absolute path
        let lib_absolute_path = game_dir.join(&lib_relative_path);

        if lib_absolute_path.exists() {
            classpath_entries.push(lib_relative_path.to_string_lossy().to_string());
        } else {
            eprintln!("[Library] WARNING: Library not found: {:?} (from {})", lib_absolute_path, library.name);
        }
    }

    // Add client JAR - check absolute path but add relative path to classpath
    let client_absolute_path = game_dir.join(client_jar);
    if client_absolute_path.exists() {
        classpath_entries.push(client_jar.to_string_lossy().to_string());
    } else {
        eprintln!("[Library] WARNING: Client JAR not found: {:?}", client_absolute_path);
    }

    // Get platform-specific separator
    let separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };

    let classpath = classpath_entries.join(separator);
    eprintln!("[Library] Built classpath with {} entries", classpath_entries.len());
    eprintln!("[Library] Classpath includes fabric-loader: {}", classpath.contains("fabric-loader"));

    Ok(classpath)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_maven_to_path() {
        let path = maven_to_path("com.mojang:logging:1.0.0");
        assert_eq!(path, "com/mojang/logging/1.0.0/logging-1.0.0.jar");
    }

    #[test]
    fn test_get_os_name() {
        let os = get_os_name();
        assert!(os == "windows" || os == "linux" || os == "osx");
    }

    #[test]
    fn test_should_download_library_no_rules() {
        let library = Library {
            name: "test:lib:1.0".to_string(),
            downloads: None,
            rules: None,
            natives: None,
            extract: None,
        };

        let features = HashMap::new();
        assert!(should_download_library(&library, &features));
    }
}
