use tokio_rusqlite::Connection;
use anyhow::Result;

pub async fn init_schema(conn: &Connection) -> Result<()> {
    conn.call(|conn| {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS player_stats (
                uuid TEXT PRIMARY KEY,
                stats_json TEXT NOT NULL,
                hash TEXT NOT NULL,
                last_updated INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_hash ON player_stats(hash);
            CREATE INDEX IF NOT EXISTS idx_last_updated ON player_stats(last_updated);"
        )
    }).await?;
    Ok(())
}
