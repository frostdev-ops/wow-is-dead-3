# wowid3-server Manager

A custom, dedicated Minecraft server manager with a beautiful web interface. Built with Rust (Axum) backend and React frontend.

## Quick Start

### Option 1: Automated Script (Recommended)

Simply run the start script from the project root:

```bash
./start.sh
```

This will:
- Start the Rust backend on `http://localhost:8080`
- Start the React frontend dev server on `http://localhost:5173`
- Create `.env` file if it doesn't exist
- Install frontend dependencies if needed

Open your browser to `http://localhost:5173` to access the web UI.

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd server
cargo run
```

**Terminal 2 - Frontend:**
```bash
cd web
npm install  # First time only
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Features

- **Server Control**: Start, stop, and restart your Minecraft server
- **Real-time Logs**: View server logs in real-time with SSE streaming
- **Server Statistics**: Monitor server uptime, memory usage, CPU usage, and player count
- **Console Commands**: Send commands directly to the server console
- **Modular Architecture**: Easy to extend with new features

## Project Structure

```
wowid3-server/
├── server/          # Rust backend (Axum)
├── web/             # React frontend
├── start.sh         # Convenience script to start both services
└── README.md
```

## Backend Setup

### Prerequisites

- Rust 1.70+ and Cargo
- Java (for running Minecraft server)
- A Minecraft server JAR file

### Configuration

1. Copy `.env.example` to `.env` in the `server/` directory:
   ```bash
   cp server/.env.example server/.env
   ```

2. Edit `.env` with your configuration:
   ```env
   SERVER_DIR=./server-data          # Path to your Minecraft server directory
   SERVER_PORT=25565                 # Minecraft server port
   API_PORT=8080                     # Server manager API port
   API_HOST=0.0.0.0                  # Host to bind to
   JAVA_PATH=java                    # Path to Java executable
   JVM_ARGS=-XX:+UseG1GC -XX:+ParallelRefProcEnabled
   MIN_RAM=2048                      # Minimum RAM in MB
   MAX_RAM=4096                      # Maximum RAM in MB
   ```

3. Build and run:
   ```bash
   cd server
   cargo build --release
   cargo run
   ```

The API will be available at `http://localhost:8080`

## Frontend Setup

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
   ```bash
   cd web
   npm install
   ```

2. Create `.env` file (optional):
   ```env
   VITE_API_URL=http://localhost:8080/api
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

The frontend will be available at `http://localhost:5173` (dev) or serve the `dist/` directory (production)

## API Endpoints

### Server Control

- `GET /api/server/status` - Get current server status
- `POST /api/server/start` - Start the server
- `POST /api/server/stop` - Stop the server
- `POST /api/server/restart` - Restart the server
- `POST /api/server/command` - Send console command
  ```json
  {
    "command": "/say Hello"
  }
  ```

### Logs

- `GET /api/logs?tail=N` - Get last N log lines
- `GET /api/logs/stream` - SSE stream for real-time logs

### Statistics

- `GET /api/stats` - Get server statistics

## Launcher Integration

The launcher can integrate with the server manager by making HTTP requests to the API:

```typescript
// Fetch server status
const response = await fetch('http://your-server:8080/api/server/status');
const status = await response.json();

// Send command
await fetch('http://your-server:8080/api/server/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: '/say Hello' }),
});
```

## Deployment

### Standalone Binary

Build a release binary:

```bash
cd server
cargo build --release
```

The binary will be at `target/release/wowid3-server`. You can run it directly or set it up as a systemd service.

### Production Build

For production, build both backend and frontend:

```bash
# Build backend
cd server
cargo build --release

# Build frontend
cd ../web
npm run build
```

The frontend can be served by any static file server, or you can integrate it into the Rust backend using `tower-http`'s `ServeDir`.

## Development

### Backend

```bash
cd server
cargo run
```

### Frontend

```bash
cd web
npm run dev
```

The frontend dev server is configured to proxy API requests to `http://localhost:8080`.

## License

This project is part of the wowid3-launcher ecosystem.

