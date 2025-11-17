use anyhow::Result;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::mpsc;

#[derive(Debug, Clone)]
pub struct ProcessHandle {
    pub pid: Option<u32>,
    pub log_sender: Option<mpsc::UnboundedSender<String>>,
}

impl ProcessHandle {
    pub fn new(pid: Option<u32>, log_sender: Option<mpsc::UnboundedSender<String>>) -> Self {
        Self { pid, log_sender }
    }
}

pub struct MinecraftProcess {
    child: Option<tokio::process::Child>,
    log_tx: mpsc::UnboundedSender<String>,
}

impl MinecraftProcess {
    pub fn new(
        jar_path: PathBuf,
        server_dir: PathBuf,
        java_path: String,
        jvm_args: Vec<String>,
        min_ram_mb: u32,
        max_ram_mb: u32,
        log_tx: mpsc::UnboundedSender<String>,
    ) -> Result<Self> {
        let mut cmd = TokioCommand::new(java_path);

        // Memory arguments
        cmd.arg(format!("-Xms{}M", min_ram_mb))
            .arg(format!("-Xmx{}M", max_ram_mb));

        // JVM args
        for arg in jvm_args {
            cmd.arg(arg);
        }

        // Minecraft server args
        cmd.arg("-jar")
            .arg(&jar_path)
            .arg("nogui")
            .current_dir(&server_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()?;

        // Spawn tasks to read stdout and stderr
        if let Some(mut stdout) = child.stdout.take() {
            let log_tx = log_tx.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(&mut stdout);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = log_tx.send(format!("[STDOUT] {}\n", line));
                }
            });
        }

        if let Some(mut stderr) = child.stderr.take() {
            let log_tx = log_tx.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(&mut stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = log_tx.send(format!("[STDERR] {}\n", line));
                }
            });
        }

        Ok(Self {
            child: Some(child),
            log_tx,
        })
    }

    pub async fn send_command(&mut self, command: &str) -> Result<()> {
        if let Some(child) = &mut self.child {
            if let Some(stdin) = child.stdin.as_mut() {
                use tokio::io::AsyncWriteExt;
                let command_with_newline = format!("{}\n", command);
                stdin.write_all(command_with_newline.as_bytes()).await?;
                self.log_tx.send(format!("[CMD] {}\n", command))?;
            }
        }
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        self.send_command("stop").await?;
        
        // Wait for process to exit (with timeout)
        if let Some(mut child) = self.child.take() {
            tokio::select! {
                result = child.wait() => {
                    result?;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
                    // Force kill if it doesn't stop within 30 seconds
                    child.kill().await.ok();
                }
            }
        }

        Ok(())
    }

    pub async fn kill(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            child.kill().await?;
        }
        Ok(())
    }

    pub fn pid(&self) -> Option<u32> {
        self.child.as_ref().and_then(|c| c.id())
    }

    pub async fn wait(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            child.wait().await?;
        }
        Ok(())
    }
}

