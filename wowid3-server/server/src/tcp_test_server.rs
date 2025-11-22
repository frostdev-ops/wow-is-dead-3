use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;
use tokio::time::{timeout, Instant};
use tracing::{error, info, warn};

const MAX_CONCURRENT_CONNECTIONS: usize = 10;
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(30);
const CHUNK_SIZE: usize = 64 * 1024; // 64KB chunks

/// TCP Test Server for network performance testing
/// Runs on port 25567 and handles DOWNLOAD_TEST, UPLOAD_TEST, and ECHO_TEST protocols
pub struct TcpTestServer {
    addr: SocketAddr,
    connection_limit: Arc<Semaphore>,
}

impl TcpTestServer {
    /// Create a new TCP test server
    pub fn new(port: u16) -> Self {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        Self {
            addr,
            connection_limit: Arc::new(Semaphore::new(MAX_CONCURRENT_CONNECTIONS)),
        }
    }

    /// Start the TCP test server
    pub async fn run(self) -> anyhow::Result<()> {
        let listener = TcpListener::bind(self.addr).await?;
        info!("TCP test server listening on {}", self.addr);

        loop {
            match listener.accept().await {
                Ok((stream, peer_addr)) => {
                    let semaphore = self.connection_limit.clone();

                    tokio::spawn(async move {
                        // Acquire permit for concurrent connection limiting
                        let _permit = match semaphore.acquire().await {
                            Ok(p) => p,
                            Err(e) => {
                                error!("Failed to acquire semaphore: {}", e);
                                return;
                            }
                        };

                        info!("New test connection from {}", peer_addr);

                        if let Err(e) = handle_connection(stream, peer_addr).await {
                            warn!("Error handling connection from {}: {}", peer_addr, e);
                        }

                        info!("Connection closed from {}", peer_addr);
                    });
                }
                Err(e) => {
                    error!("Failed to accept connection: {}", e);
                }
            }
        }
    }
}

/// Handle a single TCP test connection
async fn handle_connection(stream: TcpStream, peer_addr: SocketAddr) -> anyhow::Result<()> {
    // Set TCP keepalive
    let socket = socket2::Socket::from(stream.into_std()?);
    socket.set_keepalive(true)?;
    socket.set_nodelay(true)?; // Disable Nagle's algorithm for lower latency
    let mut stream = TcpStream::from_std(socket.into())?;

    // Read test type (first 4 bytes)
    let mut test_type = [0u8; 4];

    match timeout(CONNECTION_TIMEOUT, stream.read_exact(&mut test_type)).await {
        Ok(Ok(_)) => {},
        Ok(Err(e)) => {
            warn!("Failed to read test type from {}: {}", peer_addr, e);
            return Ok(());
        }
        Err(_) => {
            warn!("Timeout reading test type from {}", peer_addr);
            return Ok(());
        }
    }

    match &test_type {
        b"DOWN" => handle_download_test(&mut stream, peer_addr).await?,
        b"UPLD" => handle_upload_test(&mut stream, peer_addr).await?,
        b"ECHO" => handle_echo_test(&mut stream, peer_addr).await?,
        _ => {
            warn!("Unknown test type from {}: {:?}", peer_addr, test_type);
        }
    }

    Ok(())
}

/// Handle DOWNLOAD_TEST: Send data chunks to client
async fn handle_download_test(stream: &mut TcpStream, peer_addr: SocketAddr) -> anyhow::Result<()> {
    info!("Starting download test for {}", peer_addr);

    // Read duration (4 bytes, big-endian)
    let mut duration_bytes = [0u8; 4];
    stream.read_exact(&mut duration_bytes).await?;
    let duration_secs = u32::from_be_bytes(duration_bytes);
    let max_duration = 30; // Max 30 seconds
    let duration = std::cmp::min(duration_secs, max_duration);

    info!("Download test duration: {}s", duration);

    // Send ACK
    stream.write_all(b"OK").await?;
    stream.flush().await?;

    // Generate random data chunk
    let chunk: Vec<u8> = (0..CHUNK_SIZE).map(|_| rand::random::<u8>()).collect();

    let start = Instant::now();
    let test_duration = Duration::from_secs(duration as u64);
    let mut bytes_sent = 0u64;

    while start.elapsed() < test_duration {
        match timeout(Duration::from_secs(5), stream.write_all(&chunk)).await {
            Ok(Ok(_)) => {
                bytes_sent += CHUNK_SIZE as u64;
            }
            Ok(Err(e)) => {
                warn!("Write error in download test for {}: {}", peer_addr, e);
                break;
            }
            Err(_) => {
                warn!("Write timeout in download test for {}", peer_addr);
                break;
            }
        }
    }

    stream.flush().await?;
    info!("Download test complete for {}: {} bytes sent", peer_addr, bytes_sent);

    Ok(())
}

/// Handle UPLOAD_TEST: Receive data chunks from client
async fn handle_upload_test(stream: &mut TcpStream, peer_addr: SocketAddr) -> anyhow::Result<()> {
    info!("Starting upload test for {}", peer_addr);

    // Read duration (4 bytes, big-endian)
    let mut duration_bytes = [0u8; 4];
    stream.read_exact(&mut duration_bytes).await?;
    let duration_secs = u32::from_be_bytes(duration_bytes);
    let max_duration = 30; // Max 30 seconds
    let duration = std::cmp::min(duration_secs, max_duration);

    info!("Upload test duration: {}s", duration);

    // Send ACK
    stream.write_all(b"OK").await?;
    stream.flush().await?;

    let start = Instant::now();
    let test_duration = Duration::from_secs(duration as u64);
    let mut bytes_received = 0u64;
    let mut buffer = vec![0u8; CHUNK_SIZE];

    while start.elapsed() < test_duration {
        match timeout(Duration::from_secs(5), stream.read(&mut buffer)).await {
            Ok(Ok(0)) => {
                // Connection closed
                break;
            }
            Ok(Ok(n)) => {
                bytes_received += n as u64;
            }
            Ok(Err(e)) => {
                warn!("Read error in upload test for {}: {}", peer_addr, e);
                break;
            }
            Err(_) => {
                // Timeout is expected when test duration is reached
                break;
            }
        }
    }

    // Send final byte count
    stream.write_all(&bytes_received.to_be_bytes()).await?;
    stream.flush().await?;

    info!("Upload test complete for {}: {} bytes received", peer_addr, bytes_received);

    // Give the client time to read the response before closing
    tokio::time::sleep(Duration::from_millis(100)).await;

    Ok(())
}

/// Handle ECHO_TEST: Echo packets back for latency/jitter/packet loss measurement
async fn handle_echo_test(stream: &mut TcpStream, peer_addr: SocketAddr) -> anyhow::Result<()> {
    info!("Starting echo test for {}", peer_addr);

    // Read packet count (4 bytes, big-endian)
    let mut count_bytes = [0u8; 4];
    stream.read_exact(&mut count_bytes).await?;
    let packet_count = u32::from_be_bytes(count_bytes);
    let max_packets = 1000; // Max 1000 packets
    let count = std::cmp::min(packet_count, max_packets);

    info!("Echo test packet count: {}", count);

    // Send ACK
    stream.write_all(b"OK").await?;
    stream.flush().await?;

    let mut packets_echoed = 0u32;

    for _ in 0..count {
        // Read packet size (2 bytes, big-endian)
        let mut size_bytes = [0u8; 2];
        match timeout(Duration::from_secs(3), stream.read_exact(&mut size_bytes)).await {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => {
                warn!("Read error in echo test for {}: {}", peer_addr, e);
                break;
            }
            Err(_) => {
                warn!("Read timeout in echo test for {}", peer_addr);
                break;
            }
        }

        let packet_size = u16::from_be_bytes(size_bytes) as usize;

        // Limit packet size to prevent abuse
        if packet_size > 8192 {
            warn!("Packet size too large from {}: {}", peer_addr, packet_size);
            break;
        }

        // Read packet data
        let mut packet = vec![0u8; packet_size];
        match timeout(Duration::from_secs(3), stream.read_exact(&mut packet)).await {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => {
                warn!("Read error in echo test for {}: {}", peer_addr, e);
                break;
            }
            Err(_) => {
                warn!("Read timeout in echo test for {}", peer_addr);
                break;
            }
        }

        // Echo packet back
        stream.write_all(&size_bytes).await?;
        stream.write_all(&packet).await?;
        stream.flush().await?;

        packets_echoed += 1;
    }

    info!("Echo test complete for {}: {} packets echoed", peer_addr, packets_echoed);

    Ok(())
}
