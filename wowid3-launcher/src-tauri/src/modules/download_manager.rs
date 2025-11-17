use anyhow::{Context, Result};
use futures::stream::StreamExt;
use reqwest::Client;
use sha1::{Digest, Sha1};
use sha2::Sha256;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use tokio::sync::{mpsc, Semaphore};

/// Download priority levels for task scheduling
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum DownloadPriority {
    Critical = 4, // Fabric loader, client JAR
    High = 3,     // Libraries
    Medium = 2,   // Assets
    Low = 1,      // Modpack files
}

/// Hash verification type
#[derive(Debug, Clone)]
pub enum HashType {
    Sha1(String),
    Sha256(String),
    None,
}

/// Individual download task
#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub url: String,
    pub dest: PathBuf,
    pub expected_hash: HashType,
    pub priority: DownloadPriority,
    pub size: u64, // Expected size in bytes (0 if unknown)
}

/// Progress update for a single download
#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub url: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub completed: bool,
}

/// Shared download manager for coordinating concurrent downloads
pub struct DownloadManager {
    client: Client,
    semaphore: Arc<Semaphore>,
    max_retries: u32,
}

impl DownloadManager {
    /// Create a new download manager with specified concurrency limit
    pub fn new(max_concurrent: usize, max_retries: u32) -> Result<Self> {
        let client = Client::builder()
            .pool_max_idle_per_host(max_concurrent)
            .pool_idle_timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(300))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            client,
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            max_retries,
        })
    }

    /// Get the shared HTTP client
    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Download a single file with retry logic and progress tracking
    pub async fn download_file(
        &self,
        task: DownloadTask,
        progress_tx: Option<mpsc::Sender<DownloadProgress>>,
    ) -> Result<()> {
        // Acquire semaphore permit for concurrency control
        let _permit = self.semaphore.acquire().await?;

        // Attempt download with retries
        let mut attempt = 0;
        loop {
            match self.download_attempt(&task, progress_tx.clone()).await {
                Ok(_) => {
                    // Notify completion
                    if let Some(tx) = &progress_tx {
                        let _ = tx
                            .send(DownloadProgress {
                                url: task.url.clone(),
                                bytes_downloaded: task.size,
                                total_bytes: task.size,
                                completed: true,
                            })
                            .await;
                    }
                    return Ok(());
                }
                Err(e) if attempt >= self.max_retries => {
                    return Err(e).context(format!(
                        "Failed to download {} after {} attempts",
                        task.url,
                        attempt + 1
                    ));
                }
                Err(e) => {
                    let backoff = Duration::from_secs(2_u64.pow(attempt));
                    eprintln!(
                        "Download failed (attempt {}/{}): {}. Retrying in {:?}",
                        attempt + 1,
                        self.max_retries + 1,
                        e,
                        backoff
                    );
                    tokio::time::sleep(backoff).await;
                    attempt += 1;
                }
            }
        }
    }

    /// Single download attempt with streaming and hash verification
    async fn download_attempt(
        &self,
        task: &DownloadTask,
        progress_tx: Option<mpsc::Sender<DownloadProgress>>,
    ) -> Result<()> {
        // Create parent directory if needed
        if let Some(parent) = task.dest.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create parent directory")?;
        }

        // Start download
        let response = self
            .client
            .get(&task.url)
            .send()
            .await
            .context("Failed to send request")?
            .error_for_status()
            .context("HTTP error response")?;

        let total_size = response.content_length().unwrap_or(task.size);

        // Stream download to file with progress tracking
        let mut file = File::create(&task.dest)
            .await
            .context("Failed to create file")?;
        let mut stream = response.bytes_stream();
        let mut bytes_downloaded = 0u64;
        let mut hasher = create_hasher(&task.expected_hash);

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Failed to read chunk")?;

            // Update hash
            if let Some(h) = &mut hasher {
                h.update(&chunk);
            }

            // Write to file
            file.write_all(&chunk)
                .await
                .context("Failed to write chunk")?;

            bytes_downloaded += chunk.len() as u64;

            // Send progress update
            if let Some(tx) = &progress_tx {
                let _ = tx
                    .send(DownloadProgress {
                        url: task.url.clone(),
                        bytes_downloaded,
                        total_bytes: total_size,
                        completed: false,
                    })
                    .await;
            }
        }

        file.flush().await.context("Failed to flush file")?;
        drop(file);

        // Verify hash if provided
        if let Some(h) = hasher {
            verify_hash(h, &task.expected_hash, &task.dest)?;
        }

        Ok(())
    }

    /// Download multiple files concurrently
    pub async fn download_files(
        &self,
        tasks: Vec<DownloadTask>,
        progress_tx: Option<mpsc::Sender<DownloadProgress>>,
    ) -> Result<()> {
        use futures::stream::{self, StreamExt};

        // Sort by priority (highest first)
        let mut sorted_tasks = tasks;
        sorted_tasks.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Download all files concurrently (semaphore controls actual concurrency)
        let results: Vec<Result<()>> = stream::iter(sorted_tasks)
            .map(|task| {
                let manager = self;
                let tx = progress_tx.clone();
                async move { manager.download_file(task, tx).await }
            })
            .buffer_unordered(1000) // Queue up to 1000 tasks (semaphore limits actual concurrency)
            .collect()
            .await;

        // Check for any errors
        let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();
        if !errors.is_empty() {
            anyhow::bail!("Download failures: {} files failed", errors.len());
        }

        Ok(())
    }
}

/// Create appropriate hasher based on hash type
fn create_hasher(hash_type: &HashType) -> Option<Box<dyn Hasher>> {
    match hash_type {
        HashType::Sha1(_) => Some(Box::new(Sha1Hasher(Sha1::new()))),
        HashType::Sha256(_) => Some(Box::new(Sha256Hasher(Sha256::new()))),
        HashType::None => None,
    }
}

/// Verify hash matches expected value
fn verify_hash(hasher: Box<dyn Hasher>, expected: &HashType, path: &Path) -> Result<()> {
    let actual = hasher.finalize();
    let expected_str = match expected {
        HashType::Sha1(h) => h,
        HashType::Sha256(h) => h,
        HashType::None => return Ok(()),
    };

    if actual.to_lowercase() != expected_str.to_lowercase() {
        anyhow::bail!(
            "Hash mismatch for {}: expected {}, got {}",
            path.display(),
            expected_str,
            actual
        );
    }

    Ok(())
}

/// Trait for hash computation
trait Hasher: Send {
    fn update(&mut self, data: &[u8]);
    fn finalize(self: Box<Self>) -> String;
}

struct Sha1Hasher(Sha1);
impl Hasher for Sha1Hasher {
    fn update(&mut self, data: &[u8]) {
        Digest::update(&mut self.0, data);
    }
    fn finalize(self: Box<Self>) -> String {
        format!("{:x}", self.0.finalize())
    }
}

struct Sha256Hasher(Sha256);
impl Hasher for Sha256Hasher {
    fn update(&mut self, data: &[u8]) {
        Digest::update(&mut self.0, data);
    }
    fn finalize(self: Box<Self>) -> String {
        format!("{:x}", self.0.finalize())
    }
}

/// Calculate optimal concurrency based on system resources
pub fn calculate_optimal_concurrency() -> usize {
    let cores = num_cpus::get();

    // Conservative defaults based on CPU cores
    // We'll enhance this later with disk type detection
    match cores {
        1..=2 => 15,
        3..=4 => 25,
        5..=8 => 35,
        _ => 50,
    }
}
