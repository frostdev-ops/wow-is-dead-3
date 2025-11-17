use anyhow::Result;
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_dir: PathBuf,
    pub server_port: u16,
    pub api_port: u16,
    pub api_host: String,
    pub java_path: String,
    pub jvm_args: Vec<String>,
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let server_dir = env::var("SERVER_DIR")
            .unwrap_or_else(|_| "./server-data".to_string())
            .into();

        let server_port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "25565".to_string())
            .parse()
            .unwrap_or(25565);

        let api_port = env::var("API_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse()
            .unwrap_or(8080);

        let api_host = env::var("API_HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_string());

        let java_path = env::var("JAVA_PATH").unwrap_or_else(|_| "java".to_string());

        let jvm_args_str = env::var("JVM_ARGS").unwrap_or_else(|_| {
            "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200".to_string()
        });
        let jvm_args: Vec<String> = jvm_args_str
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        let min_ram_mb = env::var("MIN_RAM")
            .unwrap_or_else(|_| "2048".to_string())
            .parse()
            .unwrap_or(2048);

        let max_ram_mb = env::var("MAX_RAM")
            .unwrap_or_else(|_| "4096".to_string())
            .parse()
            .unwrap_or(4096);

        Ok(Self {
            server_dir,
            server_port,
            api_port,
            api_host,
            java_path,
            jvm_args,
            min_ram_mb,
            max_ram_mb,
        })
    }
}

