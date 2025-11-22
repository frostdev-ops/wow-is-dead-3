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
        self.init_vpn_schema().await?;
        Ok(())
    }

    async fn init_vpn_schema(&self) -> Result<()> {
        self.conn.call(|conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS vpn_peers (
                    uuid TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    public_key TEXT UNIQUE NOT NULL,
                    ip_address TEXT NOT NULL,
                    registered_at INTEGER NOT NULL,
                    last_handshake INTEGER,
                    bytes_sent INTEGER DEFAULT 0,
                    bytes_received INTEGER DEFAULT 0,
                    revoked BOOLEAN DEFAULT 0,
                    revoked_at INTEGER
                );
                CREATE INDEX IF NOT EXISTS idx_vpn_public_key ON vpn_peers(public_key);
                CREATE INDEX IF NOT EXISTS idx_vpn_username ON vpn_peers(username);
                CREATE INDEX IF NOT EXISTS idx_vpn_revoked ON vpn_peers(revoked);"
            )
        }).await?;
        Ok(())
    }
}
