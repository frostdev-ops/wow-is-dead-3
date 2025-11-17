use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub online: bool,
    pub player_count: Option<u32>,
    pub max_players: Option<u32>,
    pub players: Vec<String>,
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

/// Write a string to the stream (VarInt length prefix + UTF-8 bytes)
fn write_string(stream: &mut TcpStream, s: &str) -> Result<()> {
    let bytes = s.as_bytes();
    write_varint(stream, bytes.len() as i32)?;
    stream.write_all(bytes)?;
    Ok(())
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
    // Parse address into host and port
    let (host, port) = match parse_address(address) {
        Ok(addr) => addr,
        Err(e) => {
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

    // Run blocking I/O in tokio's blocking thread pool
    let result = tokio::task::spawn_blocking(move || {
        // Connect to server with timeout
        let stream = TcpStream::connect_timeout(
            &format!("{}:{}", host, port)
                .parse()
                .context("Failed to parse socket address")?,
            Duration::from_secs(5),
        )
        .context("Failed to connect to server")?;

        // Set read/write timeouts
        stream.set_read_timeout(Some(Duration::from_secs(5)))?;
        stream.set_write_timeout(Some(Duration::from_secs(5)))?;

        ping_server_sync(stream, &host, port)
    })
    .await;

    // Handle various error cases gracefully
    match result {
        Ok(Ok(status)) => Ok(status),
        Ok(Err(e)) => {
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
    // Packet ID: 0x00 (Handshake)
    // Protocol Version: VarInt (use 765 for 1.20.4, -1 for unknown)
    // Server Address: String
    // Server Port: Unsigned Short
    // Next State: VarInt (1 for status)

    let mut handshake_data = Vec::new();

    // Packet ID
    handshake_data.push(0x00);

    // Protocol version (-1 for any version)
    let mut protocol_bytes = Vec::new();
    let mut value = -1i32;
    loop {
        let mut temp = (value & 0x7F) as u8;
        value >>= 7;
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

    // Write packet length + packet data
    write_varint(&mut stream, handshake_data.len() as i32)?;
    stream.write_all(&handshake_data)?;

    // Step 2: Send status request packet
    // Packet ID: 0x00 (Status Request)
    // No additional data
    write_varint(&mut stream, 1)?; // Packet length
    stream.write_all(&[0x00])?; // Packet ID

    // Step 3: Read status response
    let response_length = read_varint(&mut stream)?;

    if response_length <= 0 || response_length > 1048576 {
        return Err(anyhow!("Invalid response length: {}", response_length));
    }

    // Read packet ID (should be 0x00)
    let packet_id = read_varint(&mut stream)?;
    if packet_id != 0x00 {
        return Err(anyhow!("Unexpected packet ID: {}", packet_id));
    }

    // Read JSON response
    let json_string = read_string(&mut stream)?;

    // Parse JSON
    let response: MinecraftStatusResponse = serde_json::from_str(&json_string)
        .context("Failed to parse server response JSON")?;

    // Extract information
    let version = response.version.and_then(|v| v.name);
    let player_count = response.players.as_ref().and_then(|p| p.online);
    let max_players = response.players.as_ref().and_then(|p| p.max);
    let players = response
        .players
        .and_then(|p| p.sample)
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.name)
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

/// Get detailed player list from server
pub async fn get_player_list(address: &str) -> Result<Vec<String>> {
    let status = ping_server(address).await?;
    Ok(status.players)
}

/// Background task to poll server status
pub async fn start_server_polling(
    address: String,
    interval_secs: u64,
    callback: impl Fn(ServerStatus) + Send + 'static,
) {
    tokio::spawn(async move {
        loop {
            if let Ok(status) = ping_server(&address).await {
                callback(status);
            }

            tokio::time::sleep(Duration::from_secs(interval_secs)).await;
        }
    });
}
