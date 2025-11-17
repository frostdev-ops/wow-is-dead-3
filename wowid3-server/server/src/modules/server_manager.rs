use anyhow::Result;
use crate::models::ServerState;
use crate::modules::config::Config;
use crate::modules::process::MinecraftProcess;
use crate::utils::find_jar_file;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::{mpsc, Mutex, RwLock};

pub struct ServerManager {
    config: Config,
    state: Arc<RwLock<ServerState>>,
    started_at: Arc<RwLock<Option<SystemTime>>>,
    process: Arc<Mutex<Option<MinecraftProcess>>>,
    logs: Arc<RwLock<Vec<String>>>,
}

impl ServerManager {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(ServerState::Stopped)),
            started_at: Arc::new(RwLock::new(None)),
            process: Arc::new(Mutex::new(None)),
            logs: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn state(&self) -> ServerState {
        *self.state.read().await
    }

    pub async fn started_at(&self) -> Option<SystemTime> {
        *self.started_at.read().await
    }

    pub async fn start(&self) -> Result<()> {
        let mut state = self.state.write().await;
        if *state != ServerState::Stopped {
            return Err(anyhow::anyhow!("Server is not in stopped state"));
        }

        *state = ServerState::Starting;
        drop(state); // Release lock while doing error-prone operations

        // Perform all error-prone operations
        let result: Result<()> = async {
            // Find server jar
            let jar_path = find_jar_file(&self.config.server_dir)?
                .ok_or_else(|| anyhow::anyhow!("No server jar found in {:?}", self.config.server_dir))?;

            // Create log channel
            let (log_tx, mut log_rx) = mpsc::unbounded_channel();

            // Spawn log collector task
            let logs = self.logs.clone();
            tokio::spawn(async move {
                // Limit to prevent memory issues
                let max_logs = 500;
                while let Some(msg) = log_rx.recv().await {
                    let mut logs_guard = logs.write().await;
                    logs_guard.push(msg);
                    // Keep only last N lines - more aggressive cleanup
                    if logs_guard.len() > max_logs {
                        let to_remove = logs_guard.len() - max_logs;
                        logs_guard.drain(0..to_remove);
                    }
                }
            });

            // Start process
            let process = MinecraftProcess::new(
                jar_path,
                self.config.server_dir.clone(),
                self.config.java_path.clone(),
                self.config.jvm_args.clone(),
                self.config.min_ram_mb,
                self.config.max_ram_mb,
                log_tx,
            )?;

            // Store process
            *self.process.lock().await = Some(process);
            *self.started_at.write().await = Some(SystemTime::now());

            Ok(())
        }.await;

        // Handle result and update state appropriately
        match result {
            Ok(_) => {
                *self.state.write().await = ServerState::Running;

                // Monitor process exit
                let process_handle = self.process.clone();
                let state_monitor = self.state.clone();
                let started_at_monitor = self.started_at.clone();

                tokio::spawn(async move {
                    let mut process_guard = process_handle.lock().await;
                    if let Some(mut proc) = process_guard.take() {
                        let _ = proc.wait().await;
                        *state_monitor.write().await = ServerState::Stopped;
                        *started_at_monitor.write().await = None;
                    }
                });

                Ok(())
            }
            Err(e) => {
                // Reset state to Stopped on error
                *self.state.write().await = ServerState::Stopped;
                Err(e)
            }
        }
    }

    pub async fn stop(&self) -> Result<()> {
        let mut state = self.state.write().await;
        if *state != ServerState::Running {
            return Err(anyhow::anyhow!("Server is not running"));
        }

        *state = ServerState::Stopping;

        let mut process = self.process.lock().await;
        if let Some(ref mut proc) = *process {
            proc.stop().await?;
        }

        *process = None;
        *state = ServerState::Stopped;
        *self.started_at.write().await = None;

        Ok(())
    }

    pub async fn restart(&self) -> Result<()> {
        self.stop().await?;
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        self.start().await?;
        Ok(())
    }

    pub async fn send_command(&self, command: &str) -> Result<()> {
        let mut process = self.process.lock().await;
        if let Some(ref mut proc) = *process {
            proc.send_command(command).await?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Server is not running"))
        }
    }

    pub async fn get_logs(&self, tail: Option<usize>) -> Vec<String> {
        let logs = self.logs.read().await;
        if let Some(n) = tail {
            logs.iter()
                .rev()
                .take(n)
                .rev()
                .cloned()
                .collect()
        } else {
            logs.clone()
        }
    }

    pub async fn get_new_logs(&self) -> Vec<String> {
        // New logs are already collected by the background task
        // This method can be used to check for new logs if needed
        Vec::new()
    }

    pub async fn pid(&self) -> Option<u32> {
        let process = self.process.lock().await;
        process.as_ref().and_then(|p| p.pid())
    }
}

