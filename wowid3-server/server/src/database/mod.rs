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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_vpn_schema_creation_succeeds() {
        // Create a temporary directory for the test database
        let temp_dir = tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");

        // Create database and initialize schema
        let db = Database::new(&db_path).await.expect("Failed to create database");
        db.init_schema().await.expect("Failed to initialize schema");

        // Verify that the vpn_peers table exists by querying it
        let count = db.conn.call(|conn| {
            conn.query_row("SELECT COUNT(*) FROM vpn_peers", [], |row| row.get::<_, i64>(0))
        }).await.expect("vpn_peers table should exist after schema initialization");

        // The count should be 0 for an empty table
        assert_eq!(count, 0, "vpn_peers table should be empty after initialization");
    }

    #[tokio::test]
    async fn test_schema_initialization_is_idempotent() {
        // Create a temporary directory for the test database
        let temp_dir = tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");

        // Create database and initialize schema
        let db = Database::new(&db_path).await.expect("Failed to create database");

        // Initialize schema twice
        db.init_schema().await.expect("First schema initialization failed");
        db.init_schema().await.expect("Second schema initialization should succeed (idempotent)");

        // Verify that the vpn_peers table still works correctly
        let count = db.conn.call(|conn| {
            conn.query_row("SELECT COUNT(*) FROM vpn_peers", [], |row| row.get::<_, i64>(0))
        }).await.expect("vpn_peers table should still be functional after double initialization");

        assert_eq!(count, 0, "vpn_peers table should still be empty");
    }
}
