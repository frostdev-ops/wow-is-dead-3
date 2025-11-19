use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub online: bool,
    pub player_count: Option<u32>,
    pub max_players: Option<u32>,
    pub players: Vec<PlayerInfo>,
    pub version: Option<String>,
    pub motd: Option<String>,
}

/// Minecraft server status response structure (from JSON response)
#[derive(Debug, Deserialize)]
struct MinecraftStatusResponse {
    version: Option<VersionInfo>,
    players: Option<PlayersInfo>,
    description: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct VersionInfo {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlayersInfo {
    max: Option<u32>,
    online: Option<u32>,
    sample: Option<Vec<PlayerSample>>,
}

#[derive(Debug, Deserialize)]
struct PlayerSample {
    name: String,
    id: String,
}

#[derive(Debug, Deserialize)]
struct MojangProfile {
    id: String,
    name: String,
}

/// Resolve player name from UUID using Mojang API
pub async fn resolve_player_name(uuid: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", uuid);
    
    let response = client.get(&url).send().await?;
    
    if response.status().is_success() {
        let profile: MojangProfile = response.json().await?;
        Ok(profile.name)
    } else {
        Err(anyhow::anyhow!("Failed to fetch profile: {}", response.status()))
    }
}

/// Write a VarInt to the stream
/// VarInt is a variable-length integer used in Minecraft protocol
fn write_varint(stream: &mut TcpStream, mut value: i32) -> Result<()> {
    let mut bytes = Vec::new();
    loop {
        let mut temp = (value & 0x7F) as u8;
        value >>= 7;
        if value != 0 {
            temp |= 0x80;
        }
        bytes.push(temp);
        if value == 0 {
            break;
        }
    }
    stream.write_all(&bytes)?;
    Ok(())
}

/// Read a VarInt from the stream
fn read_varint(stream: &mut TcpStream) -> Result<i32> {
    let mut num_read = 0;
    let mut result = 0;
    let mut buffer = [0u8; 1];

    loop {
        stream.read_exact(&mut buffer)?;
        let value = buffer[0];
        result |= ((value & 0x7F) as i32) << (7 * num_read);

        num_read += 1;
        if num_read > 5 {
            return Err(anyhow!("VarInt is too big"));
        }
        if (value & 0x80) == 0 {
            break;
        }
    }
    Ok(result)
}

/// Read a string from the stream (VarInt length prefix + UTF-8 bytes)
fn read_string(stream: &mut TcpStream) -> Result<String> {
    let length = read_varint(stream)? as usize;
    if length > 32767 {
        return Err(anyhow!("String length too large: {}", length));
    }
    let mut buffer = vec![0u8; length];
    stream.read_exact(&mut buffer)?;
    Ok(String::from_utf8(buffer)?)
}

/// Parse server address into host and port
fn parse_address(address: &str) -> Result<(String, u16)> {
    if let Some((host, port)) = address.rsplit_once(':') {
        let port_num = port
            .parse::<u16>()
            .context("Invalid port number")?;
        Ok((host.to_string(), port_num))
    } else {
        // Default Minecraft port
        Ok((address.to_string(), 25565))
    }
}

/// Extract plain text from Minecraft's MOTD format (JSON or legacy)
fn extract_motd_text(description: &serde_json::Value) -> String {
    match description {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(obj) => {
            if let Some(serde_json::Value::String(text)) = obj.get("text") {
                text.clone()
            } else if let Some(extra) = obj.get("extra") {
                if let serde_json::Value::Array(arr) = extra {
                    arr.iter()
                        .filter_map(|v| {
                            if let serde_json::Value::String(s) = v {
                                Some(s.as_str())
                            } else if let serde_json::Value::Object(o) = v {
                                o.get("text")
                                    .and_then(|t| t.as_str())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("")
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        }
        _ => String::new(),
    }
}

/// Ping Minecraft server and get status
/// Implements the Minecraft Server List Ping protocol (Java Edition)
/// Returns an offline ServerStatus if the server is unreachable instead of an error
pub async fn ping_server(address: &str) -> Result<ServerStatus> {
    eprintln!("[Server Ping] Starting ping for: {}", address);

    // Parse address into host and port
    let (host, port) = match parse_address(address) {
        Ok(addr) => addr,
        Err(e) => {
            eprintln!("[Server Ping] Invalid address: {}", e);
            // Return offline status for invalid addresses
            return Ok(ServerStatus {
                online: false,
                player_count: None,
                max_players: None,
                players: vec![],
                version: None,
                motd: Some(format!("Invalid address: {}", e)),
            });
        }
    };

    eprintln!("[Server Ping] Parsed address: {}:{}", host, port);

    // Run blocking I/O in tokio's blocking thread pool
    let result = tokio::task::spawn_blocking(move || -> Result<ServerStatus> {
        let addr_str = format!("{}:{}", host, port);
        eprintln!("[Server Ping] Attempting TCP connection to {}", addr_str);

        // Resolve hostname to socket addresses (important for reverse proxies!)
        eprintln!("[Server Ping] Resolving hostname: {}", host);
        let addresses: Vec<_> = match addr_str.to_socket_addrs() {
            Ok(addrs) => {
                let addr_list: Vec<_> = addrs.collect();
                eprintln!("[Server Ping] Resolved to {} address(es)", addr_list.len());
                for addr in &addr_list {
                    eprintln!("[Server Ping]   - {}", addr);
                }
                addr_list
            },
            Err(e) => {
                eprintln!("[Server Ping] DNS resolution failed: {}", e);
                return Err(anyhow::anyhow!("DNS resolution failed for '{}': {}", addr_str, e));
            }
        };

        if addresses.is_empty() {
            eprintln!("[Server Ping] No addresses returned from DNS lookup");
            return Err(anyhow::anyhow!("No addresses resolved for '{}'", addr_str));
        }

        // Try to connect to the first resolved address
        let socket_addr = addresses[0];
        eprintln!("[Server Ping] Attempting connection to {}", socket_addr);

        let stream = match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(5)) {
            Ok(s) => {
                eprintln!("[Server Ping] TCP connection successful");
                s
            },
            Err(e) => {
                eprintln!("[Server Ping] TCP connection failed: {}", e);
                return Err(anyhow::anyhow!("Failed to connect to {}: {}", socket_addr, e));
            }
        };

        // Set read/write timeouts
        stream.set_read_timeout(Some(Duration::from_secs(5)))
            .context("Failed to set read timeout")?;
        stream.set_write_timeout(Some(Duration::from_secs(5)))
            .context("Failed to set write timeout")?;

        eprintln!("[Server Ping] Sending Minecraft protocol handshake");
        ping_server_sync(stream, &host, port)
    })
    .await;

    // Handle various error cases gracefully
    match result {
        Ok(Ok(status)) => {
            eprintln!("[Server Ping] Success! Server online: {}", status.online);
            Ok(status)
        },
        Ok(Err(e)) => {
            eprintln!("[Server Ping] Protocol error: {}", e);
            // Server responded but there was a protocol error
            // Return offline status with error message
            Ok(ServerStatus {
                online: false,
                player_count: None,
                max_players: None,
                players: vec![],
                version: None,
                motd: Some(format!("Error: {}", e)),
            })
        }
        Err(e) => {
            eprintln!("[Server Ping] Task error: {}", e);
            // Task panicked or was cancelled
            Ok(ServerStatus {
                online: false,
                player_count: None,
                max_players: None,
                players: vec![],
                version: None,
                motd: Some(format!("Task error: {}", e)),
            })
        }
    }
}

/// Synchronous server ping implementation
fn ping_server_sync(mut stream: TcpStream, host: &str, port: u16) -> Result<ServerStatus> {
    // Step 1: Send handshake packet
    let mut handshake_data = Vec::new();

    // Packet ID
    handshake_data.push(0x00);

    // Protocol version (-1 for any version)
    // Note: -1 as i32 is 0xFFFFFFFF in two's complement
    // When encoding as VarInt, we need to handle the right-shift correctly.
    // Arithmetic right shift on negative numbers would keep the sign bit,
    // creating an infinite loop, so we cast to u32 for logical shift.
    let mut protocol_bytes = Vec::new();
    let mut value: i32 = -1;
    for _ in 0..5 {
        let mut temp = (value & 0x7F) as u8;
        value = (value as u32 >> 7) as i32; // Use logical shift (unsigned cast)
        if value != 0 {
            temp |= 0x80;
        }
        protocol_bytes.push(temp);
        if value == 0 {
            break;
        }
    }
    handshake_data.extend(protocol_bytes);

    // Server address (string)
    let host_bytes = host.as_bytes();
    let mut len_bytes = Vec::new();
    let mut len_value = host_bytes.len() as i32;
    loop {
        let mut temp = (len_value & 0x7F) as u8;
        len_value >>= 7;
        if len_value != 0 {
            temp |= 0x80;
        }
        len_bytes.push(temp);
        if len_value == 0 {
            break;
        }
    }
    handshake_data.extend(len_bytes);
    handshake_data.extend(host_bytes);

    // Server port (unsigned short, big-endian)
    handshake_data.push((port >> 8) as u8);
    handshake_data.push((port & 0xFF) as u8);

    // Next state (1 for status)
    handshake_data.push(0x01);

    eprintln!("[Server Ping] Handshake packet built - size: {}", handshake_data.len());

    // Write packet length + packet data
    write_varint(&mut stream, handshake_data.len() as i32).context("Failed to write handshake length")?;
    stream.write_all(&handshake_data).context("Failed to write handshake data")?;
    eprintln!("[Server Ping] Handshake sent");

    // Step 2: Send status request packet
    eprintln!("[Server Ping] Sending status request");
    write_varint(&mut stream, 1).context("Failed to write status request length")?; // Packet length
    stream.write_all(&[0x00]).context("Failed to write status request ID")?; // Packet ID
    eprintln!("[Server Ping] Status request sent");

    // Step 3: Read status response
    eprintln!("[Server Ping] Reading response length...");
    let response_length = match read_varint(&mut stream) {
        Ok(len) => {
            eprintln!("[Server Ping] Response length: {}", len);
            len
        },
        Err(e) => {
            eprintln!("[Server Ping] Failed to read response length: {}", e);
            return Err(anyhow!("Failed to read response length: {}", e));
        }
    };

    if response_length <= 0 || response_length > 1048576 {
        eprintln!("[Server Ping] Invalid response length: {}", response_length);
        return Err(anyhow!("Invalid response length: {}", response_length));
    }

    // Read packet ID (should be 0x00)
    eprintln!("[Server Ping] Reading packet ID...");
    let packet_id = match read_varint(&mut stream) {
        Ok(id) => {
            eprintln!("[Server Ping] Packet ID: {}", id);
            id
        },
        Err(e) => {
            eprintln!("[Server Ping] Failed to read packet ID: {}", e);
            return Err(anyhow!("Failed to read packet ID: {}", e));
        }
    };

    if packet_id != 0x00 {
        eprintln!("[Server Ping] Unexpected packet ID: {} (expected 0)", packet_id);
        return Err(anyhow!("Unexpected packet ID: {}", packet_id));
    }

    // Read JSON response
    eprintln!("[Server Ping] Reading JSON response...");
    let json_string = match read_string(&mut stream) {
        Ok(json) => {
            eprintln!("[Server Ping] JSON length: {}", json.len());
            json
        },
        Err(e) => {
            eprintln!("[Server Ping] Failed to read JSON: {}", e);
            return Err(anyhow!("Failed to read JSON response: {}", e));
        }
    };

    eprintln!("[Server Ping] JSON received: {}", &json_string[..json_string.len().min(100)]);

    // Parse JSON
    let response: MinecraftStatusResponse = serde_json::from_str(&json_string)
        .context("Failed to parse server response JSON")?;

    // Extract information
    let version = response.version.and_then(|v| v.name);
    let player_count = response.players.as_ref().and_then(|p| p.online);
    let max_players = response.players.as_ref().and_then(|p| p.max);
    
    // Log raw player samples for debugging
    if let Some(players_info) = &response.players {
        if let Some(samples) = &players_info.sample {
            eprintln!("[Server Ping] Raw player samples: {:?}", samples);
        } else {
            eprintln!("[Server Ping] No player samples in response");
        }
    }

    let players = response
        .players
        .and_then(|p| p.sample)
        .unwrap_or_default()
        .into_iter()
        .map(|p| PlayerInfo {
            name: p.name,
            id: p.id,
        })
        .collect();
    let motd = response.description.map(|desc| extract_motd_text(&desc));

    Ok(ServerStatus {
        online: true,
        player_count,
        max_players,
        players,
        version,
        motd,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    /// Helper function to write a VarInt for testing
    fn write_test_varint(value: i32) -> Vec<u8> {
        let mut bytes = Vec::new();
        let mut val = value;
        loop {
            let mut temp = (val & 0x7F) as u8;
            val >>= 7;
            if val != 0 {
                temp |= 0x80;
            }
            bytes.push(temp);
            if val == 0 {
                break;
            }
        }
        bytes
    }

    /// Mock Minecraft server for testing
    /// Returns a JoinHandle that MUST be joined or aborted to prevent resource leaks
    fn start_mock_server(port: u16, response_json: String) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            // Bind listener with SO_REUSEADDR to allow port reuse
            let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
                .expect("Failed to bind mock server");

            // Set a timeout on accept to prevent infinite blocking
            listener
                .set_nonblocking(true)
                .expect("Failed to set non-blocking");

            // Try to accept connection with timeout (max 5 seconds)
            let start = std::time::Instant::now();
            let timeout = Duration::from_secs(5);

            while start.elapsed() < timeout {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
                        stream.set_write_timeout(Some(Duration::from_secs(2))).ok();

                        // Read handshake packet
                        let mut buf = [0u8; 1024];
                        if stream.read(&mut buf).is_ok() {
                            // Read status request packet
                            if stream.read(&mut buf).is_ok() {
                                // Send status response
                                let json_bytes = response_json.as_bytes();
                                let json_len = write_test_varint(json_bytes.len() as i32);

                                // Calculate total packet length (packet ID + string length + string data)
                                let packet_data_len = 1 + json_len.len() + json_bytes.len();
                                let packet_len = write_test_varint(packet_data_len as i32);

                                // Write packet
                                stream.write_all(&packet_len).ok();
                                stream.write_all(&[0x00]).ok(); // Packet ID
                                stream.write_all(&json_len).ok();
                                stream.write_all(json_bytes).ok();
                                stream.flush().ok();
                            }
                        }
                        // Connection handled, exit
                        return;
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No connection yet, sleep briefly and retry
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => {
                        // Other error, exit
                        return;
                    }
                }
            }
            // Timeout reached, exit cleanly
        })
    }

    #[tokio::test]
    async fn test_parse_address_with_port() {
        let result = parse_address("localhost:25565");
        assert!(result.is_ok());
        let (host, port) = result.unwrap();
        assert_eq!(host, "localhost");
        assert_eq!(port, 25565);
    }

    #[tokio::test]
    async fn test_parse_address_without_port() {
        let result = parse_address("localhost");
        assert!(result.is_ok());
        let (host, port) = result.unwrap();
        assert_eq!(host, "localhost");
        assert_eq!(port, 25565); // Default port
    }

    #[tokio::test]
    async fn test_parse_address_invalid_port() {
        let result = parse_address("localhost:invalid");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_extract_motd_text_string() {
        let json = serde_json::json!("Simple MOTD");
        let motd = extract_motd_text(&json);
        assert_eq!(motd, "Simple MOTD");
    }

    #[tokio::test]
    async fn test_extract_motd_text_object() {
        let json = serde_json::json!({
            "text": "Server MOTD"
        });
        let motd = extract_motd_text(&json);
        assert_eq!(motd, "Server MOTD");
    }

    #[tokio::test]
    async fn test_extract_motd_text_with_extra() {
        let json = serde_json::json!({
            "text": "",
            "extra": [
                {"text": "Hello "},
                {"text": "World"}
            ]
        });
        let motd = extract_motd_text(&json);
        assert_eq!(motd, "Hello World");
    }

    #[tokio::test]
    async fn test_ping_server_offline() {
        // Try to ping a server that definitely doesn't exist
        let status = ping_server("localhost:54321").await.unwrap();
        assert_eq!(status.online, false);
        assert!(status.player_count.is_none());
        assert!(status.max_players.is_none());
    }

    #[tokio::test]
    async fn test_ping_server_invalid_address() {
        let status = ping_server("invalid:port:address").await.unwrap();
        assert_eq!(status.online, false);
        assert!(status.motd.is_some());
        assert!(status.motd.unwrap().contains("Invalid address"));
    }

    #[tokio::test]
    async fn test_ping_server_online() {
        // Find an available port
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let response_json = r#"{
            "version": {"name": "1.20.4"},
            "players": {"max": 20, "online": 5, "sample": [
                {"name": "Player1", "id": "uuid1"},
                {"name": "Player2", "id": "uuid2"}
            ]},
            "description": {"text": "Test Server"}
        }"#;

        let _server = start_mock_server(port, response_json.to_string());

        // Give server time to start
        tokio::time::sleep(Duration::from_millis(100)).await;

        let status = ping_server(&format!("127.0.0.1:{}", port))
            .await
            .unwrap();

        assert_eq!(status.online, true);
        assert_eq!(status.player_count, Some(5));
        assert_eq!(status.max_players, Some(20));
        assert_eq!(status.players.len(), 2);
        assert_eq!(status.players[0].name, "Player1");
        assert_eq!(status.players[0].id, "uuid1");
        assert_eq!(status.players[1].name, "Player2");
        assert_eq!(status.players[1].id, "uuid2");
        assert_eq!(status.version, Some("1.20.4".to_string()));
        assert_eq!(status.motd, Some("Test Server".to_string()));
    }

    #[tokio::test]
    async fn test_varint_encoding() {
        // Test VarInt encoding/decoding
        let test_values = vec![0, 1, 127, 128, 255, 256, 32767, -1];

        for value in test_values {
            let bytes = write_test_varint(value);
            assert!(!bytes.is_empty());
            assert!(bytes.len() <= 5);
        }
    }

    #[tokio::test]
    async fn test_server_timeout() {
        // Create a server that accepts but never responds
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        thread::spawn(move || {
            if let Ok((stream, _)) = listener.accept() {
                // Accept connection but never send data
                thread::sleep(Duration::from_secs(10));
                drop(stream);
            }
        });

        // Give server time to start
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Should timeout and return offline status
        let status = ping_server(&format!("127.0.0.1:{}", port))
            .await
            .unwrap();

        assert_eq!(status.online, false);
    }
}
