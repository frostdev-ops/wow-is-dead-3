use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

const TEST_SERVER_HOST: &str = "mc.frostdev.io";
const TEST_SERVER_PORT: u16 = 25567;
const GAME_SERVER_PORT: u16 = 25565;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(10);

/// Result of a complete network analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkTestResult {
    pub success: bool,
    pub timestamp: String,
    pub game_server_reachable: bool,
    pub game_server_latency_ms: Option<f64>,
    pub latency: Option<LatencyTestResult>,
    pub download_speed: Option<SpeedTestResult>,
    pub upload_speed: Option<SpeedTestResult>,
    pub packet_loss: Option<PacketLossResult>,
    pub error_message: Option<String>,
}

/// Result of latency and jitter measurements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyTestResult {
    pub min_ms: f64,
    pub max_ms: f64,
    pub avg_ms: f64,
    pub jitter_ms: f64,
    pub samples: usize,
}

/// Result of speed tests (download or upload)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    pub mbps: f64,
    pub bytes_transferred: u64,
    pub duration_ms: u64,
}

/// Result of packet loss test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketLossResult {
    pub sent: u32,
    pub received: u32,
    pub lost: u32,
    pub loss_percent: f64,
}

/// Progress event for network tests
#[derive(Debug, Clone, Serialize)]
pub struct NetworkTestProgress {
    pub test_name: String,
    pub progress_percent: u8,
    pub current_step: String,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Test game server reachability (quick TCP connection test)
#[tauri::command]
pub async fn test_game_server_reachability() -> Result<(bool, Option<f64>), String> {
    let addr = format!("{}:{}", TEST_SERVER_HOST, GAME_SERVER_PORT);

    let start = Instant::now();
    match tokio::time::timeout(
        Duration::from_secs(5),
        TcpStream::connect(&addr)
    ).await {
        Ok(Ok(_)) => {
            let latency_ms = start.elapsed().as_secs_f64() * 1000.0;
            Ok((true, Some(latency_ms)))
        }
        Ok(Err(_)) => Ok((false, None)),
        Err(_) => Ok((false, None)), // Timeout
    }
}

/// Test latency and jitter
#[tauri::command]
pub async fn test_latency_and_jitter(
    app: AppHandle,
    packet_count: u32,
) -> Result<LatencyTestResult, String> {
    emit_progress(&app, "latency", 0, "Connecting to test server...");

    let packet_count = packet_count.min(100); // Max 100 packets
    let addr = format!("{}:{}", TEST_SERVER_HOST, TEST_SERVER_PORT);

    // Connect to test server
    let mut stream = tokio::time::timeout(DEFAULT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| "Connection timeout".to_string())?
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // Disable Nagle's algorithm for lower latency
    stream.set_nodelay(true)
        .map_err(|e| format!("Failed to set TCP_NODELAY: {}", e))?;

    emit_progress(&app, "latency", 10, "Starting echo test...");

    // Send test type
    stream.write_all(b"ECHO").await
        .map_err(|e| format!("Failed to send test type: {}", e))?;

    // Send packet count
    stream.write_all(&packet_count.to_be_bytes()).await
        .map_err(|e| format!("Failed to send packet count: {}", e))?;

    // Wait for ACK
    let mut ack = [0u8; 2];
    tokio::time::timeout(Duration::from_secs(3), stream.read_exact(&mut ack))
        .await
        .map_err(|_| "ACK timeout".to_string())?
        .map_err(|e| format!("Failed to read ACK: {}", e))?;

    if &ack != b"OK" {
        return Err("Invalid ACK from server".to_string());
    }

    emit_progress(&app, "latency", 20, "Measuring round-trip times...");

    let mut latencies = Vec::new();
    let test_data = b"PING";

    for i in 0..packet_count {
        let progress = 20 + ((i as f64 / packet_count as f64) * 70.0) as u8;
        if i % 5 == 0 {
            emit_progress(
                &app,
                "latency",
                progress,
                &format!("Packet {}/{}", i + 1, packet_count),
            );
        }

        let start = Instant::now();

        // Send packet size
        let packet_size = test_data.len() as u16;
        stream.write_all(&packet_size.to_be_bytes()).await
            .map_err(|e| format!("Failed to send packet size: {}", e))?;

        // Send packet data
        stream.write_all(test_data).await
            .map_err(|e| format!("Failed to send packet: {}", e))?;

        // Flush to ensure immediate send (disable buffering)
        stream.flush().await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        // Read echoed packet size
        let mut size_bytes = [0u8; 2];
        tokio::time::timeout(Duration::from_secs(3), stream.read_exact(&mut size_bytes))
            .await
            .map_err(|_| format!("Timeout receiving packet {} echo", i + 1))?
            .map_err(|e| format!("Failed to read echo size: {}", e))?;

        // Read echoed packet data
        let echo_size = u16::from_be_bytes(size_bytes) as usize;
        let mut echo_data = vec![0u8; echo_size];
        stream.read_exact(&mut echo_data).await
            .map_err(|e| format!("Failed to read echo data: {}", e))?;

        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;
        latencies.push(latency_ms);
    }

    emit_progress(&app, "latency", 90, "Calculating statistics...");

    // Calculate statistics
    let min_ms = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_ms = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let avg_ms = latencies.iter().sum::<f64>() / latencies.len() as f64;

    // Calculate jitter (standard deviation)
    let variance = latencies
        .iter()
        .map(|&x| {
            let diff = x - avg_ms;
            diff * diff
        })
        .sum::<f64>()
        / latencies.len() as f64;
    let jitter_ms = variance.sqrt();

    emit_progress(&app, "latency", 100, "Complete");

    Ok(LatencyTestResult {
        min_ms,
        max_ms,
        avg_ms,
        jitter_ms,
        samples: latencies.len(),
    })
}

/// Test download speed
#[tauri::command]
pub async fn test_download_speed(
    app: AppHandle,
    duration_secs: u32,
) -> Result<SpeedTestResult, String> {
    emit_progress(&app, "download", 0, "Connecting to test server...");

    let duration_secs = duration_secs.min(30); // Max 30 seconds
    let addr = format!("{}:{}", TEST_SERVER_HOST, TEST_SERVER_PORT);

    // Connect to test server
    let mut stream = tokio::time::timeout(DEFAULT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| "Connection timeout".to_string())?
        .map_err(|e| format!("Failed to connect: {}", e))?;

    emit_progress(&app, "download", 10, "Starting download test...");

    // Send test type
    stream.write_all(b"DOWN").await
        .map_err(|e| format!("Failed to send test type: {}", e))?;

    // Send duration
    stream.write_all(&duration_secs.to_be_bytes()).await
        .map_err(|e| format!("Failed to send duration: {}", e))?;

    // Wait for ACK
    let mut ack = [0u8; 2];
    tokio::time::timeout(Duration::from_secs(3), stream.read_exact(&mut ack))
        .await
        .map_err(|_| "ACK timeout".to_string())?
        .map_err(|e| format!("Failed to read ACK: {}", e))?;

    if &ack != b"OK" {
        return Err("Invalid ACK from server".to_string());
    }

    emit_progress(&app, "download", 20, "Downloading data...");

    let start = Instant::now();
    let test_duration = Duration::from_secs(duration_secs as u64);
    let mut bytes_received = 0u64;
    let mut buffer = vec![0u8; 64 * 1024]; // 64KB buffer

    let mut last_progress_update = Instant::now();

    while start.elapsed() < test_duration {
        match tokio::time::timeout(Duration::from_secs(5), stream.read(&mut buffer)).await {
            Ok(Ok(0)) => break, // Connection closed
            Ok(Ok(n)) => {
                bytes_received += n as u64;

                // Update progress every 500ms
                if last_progress_update.elapsed() >= Duration::from_millis(500) {
                    let progress = 20 + ((start.elapsed().as_secs_f64() / test_duration.as_secs_f64()) * 70.0) as u8;
                    let mbps = (bytes_received as f64 * 8.0) / (start.elapsed().as_secs_f64() * 1_000_000.0);
                    emit_progress(&app, "download", progress, &format!("{:.1} Mbps", mbps));
                    last_progress_update = Instant::now();
                }
            }
            Ok(Err(e)) => {
                return Err(format!("Read error: {}", e));
            }
            Err(_) => {
                return Err("Read timeout".to_string());
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    let mbps = (bytes_received as f64 * 8.0) / (duration_ms as f64 * 1000.0);

    emit_progress(&app, "download", 100, "Complete");

    Ok(SpeedTestResult {
        mbps,
        bytes_transferred: bytes_received,
        duration_ms,
    })
}

/// Test upload speed
#[tauri::command]
pub async fn test_upload_speed(
    app: AppHandle,
    duration_secs: u32,
) -> Result<SpeedTestResult, String> {
    emit_progress(&app, "upload", 0, "Connecting to test server...");

    let duration_secs = duration_secs.min(30); // Max 30 seconds
    let addr = format!("{}:{}", TEST_SERVER_HOST, TEST_SERVER_PORT);

    // Connect to test server
    let mut stream = tokio::time::timeout(DEFAULT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| "Upload: Connection timeout".to_string())?
        .map_err(|e| format!("Upload: Failed to connect: {}", e))?;

    emit_progress(&app, "upload", 10, "Starting upload test...");

    // Send test type
    stream.write_all(b"UPLD").await
        .map_err(|e| format!("Upload: Failed to send test type: {}", e))?;

    // Send duration
    stream.write_all(&duration_secs.to_be_bytes()).await
        .map_err(|e| format!("Upload: Failed to send duration: {}", e))?;

    stream.flush().await
        .map_err(|e| format!("Upload: Failed to flush: {}", e))?;

    // Wait for ACK
    let mut ack = [0u8; 2];
    tokio::time::timeout(Duration::from_secs(5), stream.read_exact(&mut ack))
        .await
        .map_err(|_| "Upload: ACK timeout (server may not be responding)".to_string())?
        .map_err(|e| format!("Upload: Failed to read ACK: {}", e))?;

    if &ack != b"OK" {
        return Err(format!("Upload: Invalid ACK from server: {:?}", ack));
    }

    emit_progress(&app, "upload", 20, "Uploading data...");

    // Generate random data chunk
    let chunk: Vec<u8> = (0..65536).map(|_| rand::random::<u8>()).collect();

    let start = Instant::now();
    let test_duration = Duration::from_secs(duration_secs as u64);
    let mut bytes_sent = 0u64;

    let mut last_progress_update = Instant::now();

    while start.elapsed() < test_duration {
        match tokio::time::timeout(Duration::from_secs(5), stream.write_all(&chunk)).await {
            Ok(Ok(_)) => {
                bytes_sent += chunk.len() as u64;

                // Update progress every 500ms
                if last_progress_update.elapsed() >= Duration::from_millis(500) {
                    let progress = 20 + ((start.elapsed().as_secs_f64() / test_duration.as_secs_f64()) * 70.0) as u8;
                    let mbps = (bytes_sent as f64 * 8.0) / (start.elapsed().as_secs_f64() * 1_000_000.0);
                    emit_progress(&app, "upload", progress, &format!("{:.1} Mbps", mbps));
                    last_progress_update = Instant::now();
                }
            }
            Ok(Err(e)) => {
                return Err(format!("Write error: {}", e));
            }
            Err(_) => {
                return Err("Write timeout".to_string());
            }
        }
    }

    // Signal end of upload by shutting down the write side
    stream.shutdown().await
        .map_err(|e| format!("Upload: Failed to shutdown write: {}", e))?;

    emit_progress(&app, "upload", 90, "Waiting for server confirmation...");

    // Read final byte count from server
    let mut count_bytes = [0u8; 8];
    match tokio::time::timeout(Duration::from_secs(5), stream.read_exact(&mut count_bytes)).await {
        Ok(Ok(_)) => {
            // Successfully read byte count
        }
        Ok(Err(e)) => {
            return Err(format!("Upload: Failed to read final count: {}", e));
        }
        Err(_) => {
            return Err(format!("Upload: Timeout reading final count. Sent {} bytes in {:.1}s", bytes_sent, start.elapsed().as_secs_f64()));
        }
    }

    let server_received = u64::from_be_bytes(count_bytes);

    let duration_ms = start.elapsed().as_millis() as u64;
    let mbps = (server_received as f64 * 8.0) / (duration_ms as f64 * 1000.0);

    emit_progress(&app, "upload", 100, "Complete");

    Ok(SpeedTestResult {
        mbps,
        bytes_transferred: server_received,
        duration_ms,
    })
}

/// Test packet loss
#[tauri::command]
pub async fn test_packet_loss(
    app: AppHandle,
    packet_count: u32,
) -> Result<PacketLossResult, String> {
    emit_progress(&app, "packet_loss", 0, "Starting packet loss test...");

    let packet_count = packet_count.min(100); // Max 100 packets

    // Use the same echo test but track losses
    let addr = format!("{}:{}", TEST_SERVER_HOST, TEST_SERVER_PORT);

    let mut stream = tokio::time::timeout(DEFAULT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| "Connection timeout".to_string())?
        .map_err(|e| format!("Failed to connect: {}", e))?;

    emit_progress(&app, "packet_loss", 10, "Connected");

    // Send test type
    stream.write_all(b"ECHO").await
        .map_err(|e| format!("Failed to send test type: {}", e))?;

    // Send packet count
    stream.write_all(&packet_count.to_be_bytes()).await
        .map_err(|e| format!("Failed to send packet count: {}", e))?;

    // Wait for ACK
    let mut ack = [0u8; 2];
    tokio::time::timeout(Duration::from_secs(3), stream.read_exact(&mut ack))
        .await
        .map_err(|_| "ACK timeout".to_string())?
        .map_err(|e| format!("Failed to read ACK: {}", e))?;

    if &ack != b"OK" {
        return Err("Invalid ACK from server".to_string());
    }

    emit_progress(&app, "packet_loss", 20, "Sending packets...");

    let mut received_count = 0u32;
    let test_data = b"LOSS_TEST_PACKET";

    for i in 0..packet_count {
        let progress = 20 + ((i as f64 / packet_count as f64) * 70.0) as u8;
        if i % 5 == 0 {
            emit_progress(
                &app,
                "packet_loss",
                progress,
                &format!("Packet {}/{}", i + 1, packet_count),
            );
        }

        // Send packet size
        let packet_size = test_data.len() as u16;
        if stream.write_all(&packet_size.to_be_bytes()).await.is_err() {
            continue; // Count as loss
        }

        // Send packet data
        if stream.write_all(test_data).await.is_err() {
            continue; // Count as loss
        }

        // Try to read echo with timeout
        let mut size_bytes = [0u8; 2];
        match tokio::time::timeout(Duration::from_millis(500), stream.read_exact(&mut size_bytes)).await {
            Ok(Ok(_)) => {
                // Read echo data
                let echo_size = u16::from_be_bytes(size_bytes) as usize;
                let mut echo_data = vec![0u8; echo_size];
                if stream.read_exact(&mut echo_data).await.is_ok() {
                    received_count += 1;
                }
            }
            _ => {
                // Timeout or error = packet loss
            }
        }
    }

    let lost = packet_count - received_count;
    let loss_percent = (lost as f64 / packet_count as f64) * 100.0;

    emit_progress(&app, "packet_loss", 100, "Complete");

    Ok(PacketLossResult {
        sent: packet_count,
        received: received_count,
        lost,
        loss_percent,
    })
}

/// Run a full network analysis (all tests)
#[tauri::command]
pub async fn run_full_network_analysis(app: AppHandle) -> Result<NetworkTestResult, String> {
    let timestamp = chrono::Local::now().to_rfc3339();

    emit_progress(&app, "full_analysis", 0, "Testing game server reachability...");

    // Test 1: Game server reachability
    let (game_server_reachable, game_server_latency_ms) =
        test_game_server_reachability().await.unwrap_or((false, None));

    emit_progress(&app, "full_analysis", 20, "Testing latency and jitter...");

    // Test 2: Latency and jitter
    let latency = test_latency_and_jitter(app.clone(), 30).await.ok();

    emit_progress(&app, "full_analysis", 40, "Testing download speed...");

    // Test 3: Download speed
    let download_speed = test_download_speed(app.clone(), 15).await.ok();

    emit_progress(&app, "full_analysis", 60, "Testing upload speed...");

    // Test 4: Upload speed
    let upload_speed = test_upload_speed(app.clone(), 15).await.ok();

    emit_progress(&app, "full_analysis", 80, "Testing packet loss...");

    // Test 5: Packet loss
    let packet_loss = test_packet_loss(app.clone(), 50).await.ok();

    emit_progress(&app, "full_analysis", 100, "Complete");

    let success = game_server_reachable
        && latency.is_some()
        && download_speed.is_some()
        && upload_speed.is_some()
        && packet_loss.is_some();

    // Build detailed error message
    let error_message = if success {
        None
    } else {
        let mut failures = Vec::new();
        if !game_server_reachable {
            failures.push("Game server unreachable");
        }
        if latency.is_none() {
            failures.push("Latency test failed");
        }
        if download_speed.is_none() {
            failures.push("Download speed test failed");
        }
        if upload_speed.is_none() {
            failures.push("Upload speed test failed");
        }
        if packet_loss.is_none() {
            failures.push("Packet loss test failed");
        }
        Some(format!("Failed tests: {}", failures.join(", ")))
    };

    Ok(NetworkTestResult {
        success,
        timestamp,
        game_server_reachable,
        game_server_latency_ms,
        latency,
        download_speed,
        upload_speed,
        packet_loss,
        error_message,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Emit a progress event
fn emit_progress(app: &AppHandle, test_name: &str, progress_percent: u8, current_step: &str) {
    let _ = app.emit(
        "network-test-progress",
        NetworkTestProgress {
            test_name: test_name.to_string(),
            progress_percent,
            current_step: current_step.to_string(),
        },
    );
}
