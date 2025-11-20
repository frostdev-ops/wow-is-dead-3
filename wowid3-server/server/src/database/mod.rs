use tokio_rusqlite::Connection;
use anyhow::Result;
use std::path::Path;

pub mod stats;

#[derive(Clone)]
pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub async fn new(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path).await?;
        
        // Enable WAL mode for better concurrency
        conn.call(|conn| {
            conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 PRAGMA foreign_keys = ON;",
            )
        }).await?;

        Ok(Self { conn })
    }

    pub async fn init_schema(&self) -> Result<()> {
        stats::init_schema(&self.conn).await?;
        Ok(())
    }
}
