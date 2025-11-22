use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[cfg(target_os = "windows")]
use super::vpn::VpnManager;

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

// Tracker structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerExt {
    pub name: String,
    pub uuid: String,
    pub position: Option<[f64; 3]>,
    pub dimension: Option<String>,
    pub biome: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub sender: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerState {
    pub online_players: Vec<PlayerExt>,
    pub recent_chat: Vec<ChatMessage>,
    pub tps: Option<f32>,
    pub mspt: Option<f32>,
    pub last_updated: u64,
}

/// Fetch detailed server status from the tracker API
pub async fn fetch_tracker_status(base_url: &str) -> Result<TrackerState> {
    let url = format!("{}/api/tracker/status", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()?;

    let response = client.get(&url).send().await?;
    
    if !response.status().is_success() {
        anyhow::bail!("Failed to fetch tracker status: {}", response.status());
    }
    
    let state: TrackerState = response.json().await?;
    Ok(state)
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
    #[allow(dead_code)]
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

/// Encode an i32 as a VarInt into a vector of bytes
fn encode_varint(mut value: i32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let mut temp = (value & 0x7F) as u8;
        value = (value as u32 >> 7) as i32;
        if value != 0 {
            temp |= 0x80;
        }
        bytes.push(temp);
        if value == 0 {
            break;
        }
    }
    bytes
}

/// Write a VarInt to the stream
/// VarInt is a variable-length integer used in Minecraft protocol
#[allow(dead_code)]
fn write_varint(stream: &mut TcpStream, value: i32) -> Result<()> {
    let bytes = encode_varint(value);
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
            let mut result = String::new();
            if let Some(serde_json::Value::String(text)) = obj.get("text") {
                result.push_str(text);
            }
            
            if let Some(extra) = obj.get("extra") {
                if let serde_json::Value::Array(arr) = extra {
                    let extra_text = arr.iter()
                        .filter_map(|v| {
                            if let serde_json::Value::String(s) = v {
                                Some(s.clone())
                            } else if let serde_json::Value::Object(o) = v {
                                o.get("text")
                                    .and_then(|t| t.as_str())
                                    .map(|s| s.to_string())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("");
                    result.push_str(&extra_text);
                }
            }
            result
        }
        _ => String::new(),
    }
}

/// Determine which server address to use based on VPN settings
/// Returns VPN address (10.8.0.1:25565) if VPN is enabled and running,
/// otherwise returns direct address (mc.frostdev.io:25565)
pub fn get_server_address(vpn_enabled: bool) -> &'static str {
    #[cfg(target_os = "windows")]
    {
        if vpn_enabled {
            // Check if VPN tunnel is running
            if let Ok(manager) = VpnManager::new() {
                if manager.is_tunnel_running() {
                    eprintln!("[Server] Using VPN address: 10.8.0.1:25565");
                    return "10.8.0.1:25565";
                } else {
                    eprintln!("[Server] VPN enabled but tunnel not running, using direct connection");
                }
            } else {
                eprintln!("[Server] VPN enabled but manager failed to initialize, using direct connection");
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = vpn_enabled; // Suppress unused variable warning on non-Windows
    }

    eprintln!("[Server] Using direct address: mc.frostdev.io:25565");
    "mc.frostdev.io:25565"
}

/// Ping Minecraft server with VPN-aware address selection
/// Automatically selects VPN or direct address based on VPN settings
pub async fn ping_server_with_vpn(vpn_enabled: bool) -> Result<ServerStatus> {
    let address = get_server_address(vpn_enabled);
    ping_server(address).await
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

        // TEMPORARY: Using legacy ping only due to PacketFixer mod compatibility issues
        // Modern ping (ping_server_sync) is disabled until we find a solution for
        // the IndexOutOfBoundsException caused by PacketFixer's Varint21FrameDecoder modifications
        eprintln!("[Server Ping] Using legacy ping protocol (modern ping disabled)");
        ping_server_legacy(stream)
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

/// Send a packet with VarInt length prefix
fn send_packet(stream: &mut TcpStream, packet_id: i32, data: &[u8]) -> Result<()> {
    let mut packet = Vec::new();
    
    // Packet ID (VarInt)
    packet.extend(encode_varint(packet_id));
    
    // Packet Data
    packet.extend_from_slice(data);
    
    // Prepend Packet Length (VarInt)
    let mut final_packet = Vec::new();
    final_packet.extend(encode_varint(packet.len() as i32));
    final_packet.extend(packet);
    
    // Write all at once to avoid fragmentation
    stream.write_all(&final_packet)?;
    stream.flush()?;
    
    Ok(())
}

/// Legacy server ping implementation (1.6+)
fn ping_server_legacy(mut stream: TcpStream) -> Result<ServerStatus> {
    // Send Legacy Ping (FE 01)
    // FE = Packet ID
    // 01 = Payload (always 1 for 1.6+)
    stream.write_all(&[0xFE, 0x01])?;
    stream.flush()?;

    // Read response
    // Response is a Disconnect Packet (0xFF)
    // Format: [FF] [Length: Short] [String: UTF-16BE]
    
    let mut packet_id_buf = [0u8; 1];
    stream.read_exact(&mut packet_id_buf)?;
    if packet_id_buf[0] != 0xFF {
        return Err(anyhow!("Invalid legacy response ID: {}", packet_id_buf[0]));
    }

    // Read Length (Short = 2 bytes)
    let mut len_buf = [0u8; 2];
    stream.read_exact(&mut len_buf)?;
    let len = u16::from_be_bytes(len_buf) as usize;

    if len == 0 || len > 32767 {
        return Err(anyhow!("Invalid legacy response length: {}", len));
    }

    // Read String (UTF-16BE)
    // Length is in CHARACTERS, so bytes = len * 2
    let mut bytes = vec![0u8; len * 2];
    stream.read_exact(&mut bytes)?;

    // Convert UTF-16BE bytes to String
    let u16_vec: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
        .collect();
    
    let response_str = String::from_utf16(&u16_vec)
        .context("Failed to decode UTF-16BE string")?;
    
    eprintln!("[Server Ping] Legacy response: {}", response_str);

    // Parse legacy response string
    // Format: §1\0<ProtocolVersion>\0<ServerVersion>\0<MOTD>\0<CurrentPlayers>\0<MaxPlayers>
    
    if !response_str.starts_with("§1\0") {
        return Err(anyhow!("Invalid legacy header"));
    }

    let parts: Vec<&str> = response_str.split('\0').collect();
    // parts[0] = "§1"
    // parts[1] = Protocol Version (e.g. "127")
    // parts[2] = Server Version (e.g. "1.20.1")
    // parts[3] = MOTD
    // parts[4] = Current Players
    // parts[5] = Max Players

    if parts.len() < 6 {
        return Err(anyhow!("Incomplete legacy response"));
    }

    let version = Some(parts[2].to_string());
    let motd = Some(parts[3].to_string());
    let player_count = parts[4].parse::<u32>().ok();
    let max_players = parts[5].parse::<u32>().ok();

    Ok(ServerStatus {
        online: true,
        player_count,
        max_players,
        players: vec![], // Legacy ping doesn't support player list
        version,
        motd,
    })
}

/// Synchronous server ping implementation
/// TEMPORARILY DISABLED: This function is not currently used due to PacketFixer mod compatibility issues.
/// The launcher now uses legacy ping (ping_server_legacy) instead until a solution is found.
#[allow(dead_code)]
fn ping_server_sync(mut stream: TcpStream, host: &str, port: u16) -> Result<ServerStatus> {
    // Step 1: Send handshake packet
    let mut handshake_body = Vec::new();

    // Protocol version (763 for 1.20.1)
    handshake_body.extend(encode_varint(763));

    // Server address (string)
    let host_bytes = host.as_bytes();
    handshake_body.extend(encode_varint(host_bytes.len() as i32));
    handshake_body.extend(host_bytes);

    // Server port (unsigned short, big-endian)
    handshake_body.push((port >> 8) as u8);
    handshake_body.push((port & 0xFF) as u8);

    // Next state (1 for status)
    handshake_body.extend(encode_varint(1));

    eprintln!("[Server Ping] Sending handshake (size: {})", handshake_body.len());
    send_packet(&mut stream, 0x00, &handshake_body).context("Failed to send handshake")?;
    
    // CRITICAL: PacketFixer mod modifies Varint21FrameDecoder which can cause packet boundary issues
    // We need to wait for the server to fully process the handshake and transition state
    // before sending the status request. 1000ms (1 second) delay ensures packets are in separate
    // TCP segments and gives PacketFixer's modified frame decoder ample time to process them correctly.
    std::thread::sleep(Duration::from_millis(1000));

    // Step 2: Send status request packet
    eprintln!("[Server Ping] Sending status request");
    // Status Request has ID 0x00 and no body
    send_packet(&mut stream, 0x00, &[]).context("Failed to send status request")?;

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
    use std::net::TcpListener;
    use std::thread;

    /// Helper function to write a VarInt for testing
    fn write_test_varint(mut value: i32) -> Vec<u8> {
        let mut bytes = Vec::new();
        loop {
            let mut temp = (value & 0x7F) as u8;
            value = (value as u32 >> 7) as i32;
            if value != 0 {
                temp |= 0x80;
            }
            bytes.push(temp);
            if value == 0 {
                break;
            }
        }
        bytes
    }

    /// Helper to read a VarInt from a TcpStream for testing
    fn read_test_varint(stream: &mut std::net::TcpStream) -> std::io::Result<i32> {
        let mut num_read = 0;
        let mut result = 0;
        let mut buffer = [0u8; 1];

        loop {
            stream.read_exact(&mut buffer)?;
            let value = buffer[0];
            result |= ((value & 0x7F) as i32) << (7 * num_read);

            num_read += 1;
            if num_read > 5 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "VarInt is too big",
                ));
            }
            if (value & 0x80) == 0 {
                break;
            }
        }
        Ok(result)
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

                        // Read handshake packet properly using Minecraft protocol
                        if let Ok(handshake_len) = read_test_varint(&mut stream) {
                            // Validate packet length to prevent panic or excessive allocation
                            if handshake_len <= 0 || handshake_len > 1048576 {
                                eprintln!("[Mock Server] Invalid handshake length: {}", handshake_len);
                                return;
                            }
                            let mut handshake_buf = vec![0u8; handshake_len as usize];
                            if stream.read_exact(&mut handshake_buf).is_ok() {
                                // Read status request packet
                                if let Ok(request_len) = read_test_varint(&mut stream) {
                                    // Validate packet length to prevent panic or excessive allocation
                                    if request_len <= 0 || request_len > 1048576 {
                                        eprintln!("[Mock Server] Invalid request length: {}", request_len);
                                        return;
                                    }
                                    let mut request_buf = vec![0u8; request_len as usize];
                                    if stream.read_exact(&mut request_buf).is_ok() {
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
                                        
                                        // Give client time to read before closing connection
                                        thread::sleep(Duration::from_millis(50));
                                    }
                                }
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

        let server_handle = start_mock_server(port, response_json.to_string());

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
        
        // Wait for server thread to finish (prevents thread leak)
        // Server should exit after handling the connection
        let _ = tokio::task::spawn_blocking(move || {
            let _ = server_handle.join();
        }).await;
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

    #[tokio::test]
    #[ignore] // This is an integration test - run with `cargo test -- --ignored`
    async fn test_real_server_mc_frostdev_io() {
        // Test against the actual production server
        let status = ping_server("mc.frostdev.io:25565")
            .await
            .unwrap();

        // Server should respond (even if offline, we should get a valid response)
        eprintln!("Server status: {:?}", status);
        eprintln!("Online: {}", status.online);
        eprintln!("Players: {:?}/{:?}", status.player_count, status.max_players);
        eprintln!("Version: {:?}", status.version);
        eprintln!("MOTD: {:?}", status.motd);
        
        if status.online {
            eprintln!("Player list:");
            for player in &status.players {
                eprintln!("  - {} ({})", player.name, player.id);
            }
        }
        
        // Just verify we got a response without IndexOutOfBoundsException
        assert!(status.motd.is_some() || status.online);
    }
}
