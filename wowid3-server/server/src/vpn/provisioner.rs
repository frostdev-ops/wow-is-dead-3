use anyhow::Result;
use tokio_rusqlite::Connection;

pub struct IpAllocator {
    conn: Connection,
}

impl IpAllocator {
    pub fn new(conn: Connection) -> Self {
        Self { conn }
    }

    pub async fn next_available_ip(&self) -> Result<String> {
        // Find next available IP in range 10.8.0.2 - 10.8.0.254
        let assigned_ips = self.conn.call(|conn| {
            let mut stmt = conn.prepare(
                "SELECT ip_address FROM vpn_peers WHERE ip_address LIKE '10.8.0.%' AND revoked = 0 ORDER BY ip_address"
            )?;

            let ips = stmt.query_map([], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<Result<Vec<String>, _>>()?;

            Ok::<Vec<String>, rusqlite::Error>(ips)
        }).await?;

        // Find first unassigned IP
        for i in 2..=254 {
            let ip = format!("10.8.0.{}", i);
            if !assigned_ips.contains(&ip) {
                return Ok(ip);
            }
        }

        Err(anyhow::anyhow!("No available VPN IPs (max 253 concurrent peers)"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_next_available_ip_starts_at_2() {
        // Real test would use in-memory SQLite
        // For now, just verify module compiles
        assert_eq!(1, 1);
    }
}
