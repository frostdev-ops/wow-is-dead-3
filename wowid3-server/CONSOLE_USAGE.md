# Pterodactyl Egg Console Usage Guide

Complete instructions for importing and using the Fabric Server egg via Pterodactyl's console/CLI and API.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Import Egg via API](#import-egg-via-api)
3. [Import Egg via Panel](#import-egg-via-panel)
4. [Create Server with Egg](#create-server-with-egg)
5. [Upload Server Files](#upload-server-files)
6. [Start and Manage Server](#start-and-manage-server)
7. [Common Commands](#common-commands)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Pterodactyl Panel installed and accessible
- Admin access to the panel
- API key with appropriate permissions (if using API)
- Server JAR file ready (Fabric server)

---

## Import Egg via API

### Step 1: Get Your API Key

1. Log into Pterodactyl Panel
2. Go to **Account Settings** → **API Credentials**
3. Click **Create New** and give it appropriate permissions:
   - `egg.create`
   - `egg.read`
   - `egg.update`
4. Copy the API key (you'll only see it once)

### Step 2: Find Your Nest ID

List all nests:

```bash
curl -X GET "https://your-panel.com/api/application/nests" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json"
```

Find the nest you want to use (e.g., "Minecraft") and note its `id` field.

### Step 3: Import the Egg

From the wowid3-server directory:

```bash
# Set your variables
PANEL_URL="https://your-panel.com"
API_KEY="your_api_key_here"
NEST_ID="1"  # Replace with your nest ID

# Import the egg
curl -X POST "${PANEL_URL}/api/application/nests/${NEST_ID}/import" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d @eggs/fabric-server.json
```

### Step 4: Verify Import

List eggs in the nest:

```bash
curl -X GET "${PANEL_URL}/api/application/nests/${NEST_ID}/eggs" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

Look for "Fabric Server" in the response.

---

## Import Egg via Panel

### Step 1: Access Admin Panel

1. Log into Pterodactyl as admin
2. Navigate to **Admin Panel** → **Nests**

### Step 2: Select Nest

1. Click on the nest you want to add the egg to (e.g., "Minecraft")
2. Or create a new nest if needed

### Step 3: Import Egg

1. On the nest page, click the **Import Egg** button (green button, top right)
2. You have two options:

   **Option A: Upload JSON File**
   - Click "Choose File"
   - Select `wowid3-server/eggs/fabric-server.json`
   - Click "Import"

   **Option B: Paste JSON**
   - Copy the contents of the egg JSON:
     ```bash
     cat eggs/fabric-server.json | xclip -selection clipboard  # Linux
     # or
     cat eggs/fabric-server.json | pbcopy  # macOS
     ```
   - Paste into the text area
   - Click "Import"

3. The egg should now appear in the egg list

---

## Create Server with Egg

### Via API

```bash
# Set your variables
PANEL_URL="https://your-panel.com"
API_KEY="your_api_key_here"
USER_ID="1"  # User who will own the server
NEST_ID="1"
EGG_ID="5"   # ID of the Fabric Server egg
NODE_ID="1"  # Node to create server on

# Create server
curl -X POST "${PANEL_URL}/api/application/servers" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "wowid3-fabric-1",
    "name": "WOWID3 Fabric Server",
    "description": "Fabric modded Minecraft server",
    "user": '${USER_ID}',
    "egg": '${EGG_ID}',
    "docker_image": "ghcr.io/pterodactyl/yolks:java_21",
    "startup": "java -Xms{{MIN_MEMORY}}M -Xmx{{MAX_MEMORY}}M {{JVM_ARGS}} -jar {{SERVER_JARFILE}} nogui",
    "environment": {
      "SERVER_JARFILE": "server.jar",
      "MIN_MEMORY": "4096",
      "MAX_MEMORY": "4096",
      "SERVER_MAX_PLAYERS": "20",
      "SERVER_VIEW_DISTANCE": "10",
      "SERVER_SIMULATION_DISTANCE": "10",
      "SERVER_DIFFICULTY": "easy",
      "SERVER_HARDCORE": "false",
      "SERVER_PVP": "true",
      "SERVER_ONLINE_MODE": "true",
      "SERVER_WHITELIST": "false",
      "SERVER_MOTD": "WOWID3 Fabric Server"
    },
    "limits": {
      "memory": 4096,
      "swap": 0,
      "disk": 10240,
      "io": 500,
      "cpu": 200
    },
    "feature_limits": {
      "databases": 0,
      "allocations": 1,
      "backups": 5
    },
    "allocation": {
      "default": 1
    }
  }'
```

### Via Panel

1. Go to **Servers** → **Create New**
2. Fill in server details:
   - **Server Name**: WOWID3 Fabric Server
   - **Owner**: Select user
   - **Nest**: Select the nest containing the Fabric Server egg
   - **Egg**: Select "Fabric Server"
3. Configure resource limits:
   - **Memory**: 4096 MB (or more for larger modpacks)
   - **Disk**: 10240 MB (10 GB, adjust as needed)
   - **CPU**: 200% (2 cores)
4. Select **Node** and **Allocation** (port)
5. Click **Create Server**

---

## Upload Server Files

### Step 1: Get Server UUID

Via API:

```bash
curl -X GET "${PANEL_URL}/api/application/servers" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[] | select(.attributes.name=="WOWID3 Fabric Server")'
```

Note the `identifier` (UUID) field.

### Step 2: Upload server.jar

**Option A: Via SFTP**

1. In the server panel, go to **Settings** → **SFTP Details**
2. Use an SFTP client (FileZilla, WinSCP, or command line):

```bash
# Using scp
scp ../wowid3-server-data/server.jar your-user@your-panel.com:/home/container/

# Or using sftp
sftp your-user@your-panel.com
put ../wowid3-server-data/server.jar
```

**Option B: Via File Manager**

1. Go to server panel → **Files**
2. Click **Upload** button
3. Select `wowid3-server-data/server.jar`
4. Wait for upload to complete

**Option C: Via wget/curl (from server console)**

If your server.jar is hosted somewhere:

```bash
wget -O server.jar https://your-host.com/server.jar
# or
curl -o server.jar https://your-host.com/server.jar
```

### Step 3: Upload Mods and Configs

Upload the following directories from `wowid3-server-data`:
- `mods/` → Server mods directory
- `config/` → Server configuration
- `kubejs/` → KubeJS scripts (if applicable)

You can use SFTP or create a zip file:

```bash
cd ../wowid3-server-data
zip -r server-files.zip mods config kubejs world
# Upload server-files.zip via panel, then unzip in console:
# unzip server-files.zip
```

---

## Start and Manage Server

### Start Server

**Via Panel:**
1. Go to server dashboard
2. Click the **Start** button

**Via API:**

```bash
SERVER_UUID="your-server-uuid"

curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/power" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"signal": "start"}'
```

### Monitor Console

**Via Panel:**
- Watch the **Console** tab in real-time

**Via WebSocket (advanced):**

```bash
# Get WebSocket credentials
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/websocket" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

### Send Commands

**Via Panel Console:**
- Type commands directly in the console input box
- Example: `say Hello World`

**Via API:**

```bash
curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/command" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"command": "say Hello from API!"}'
```

### Stop Server

**Via Panel:**
- Click **Stop** button

**Via API:**

```bash
curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/power" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"signal": "stop"}'
```

---

## Common Commands

### Check Server Status

```bash
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/resources" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

### Get Server Files List

```bash
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/files/list" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

### Read Server File

```bash
# Read server.properties
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/files/contents?file=/server.properties" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

### Update Server Variable

```bash
# Update max players
curl -X PUT "${PANEL_URL}/api/client/servers/${SERVER_UUID}/startup/variable" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SERVER_MAX_PLAYERS",
    "value": "30"
  }'
```

### Create Backup

```bash
curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/backups" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "before-update-$(date +%Y%m%d)",
    "ignored": "*.log,cache/*"
  }'
```

### List Backups

```bash
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/backups" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

### Restore Backup

```bash
BACKUP_UUID="backup-uuid-here"

curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/backups/${BACKUP_UUID}/restore" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

---

## Troubleshooting

### Server Won't Start

1. **Check console logs:**
   ```bash
   curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/logs" \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "Accept: application/json"
   ```

2. **Verify Java version in container:**
   - Send command: `java -version`

3. **Check if server.jar exists:**
   ```bash
   curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/files/list" \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "Accept: application/json" | jq '.data[] | select(.attributes.name=="server.jar")'
   ```

### Out of Memory

1. **Check current memory allocation:**
   ```bash
   curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}" \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "Accept: application/json" | jq '.attributes.limits.memory'
   ```

2. **Update memory limits (requires admin):**
   ```bash
   curl -X PATCH "${PANEL_URL}/api/application/servers/${SERVER_ID}/build" \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -d '{
       "memory": 8192,
       "swap": 0
     }'
   ```

### Permission Errors

1. **Fix file permissions via console:**
   - Send command in console: `chmod -R 755 .`

### View Real-time Logs

**Using tail with API:**

```bash
# Stream logs (requires WebSocket)
# Or check latest logs:
curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/files/contents?file=/logs/latest.log" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json"
```

---

## Quick Reference Script

Save this as `pterodactyl-cli.sh` for easy management:

```bash
#!/bin/bash

PANEL_URL="https://your-panel.com"
API_KEY="your_api_key_here"
SERVER_UUID="your-server-uuid"

case "$1" in
  start)
    curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/power" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"signal": "start"}'
    ;;
  stop)
    curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/power" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"signal": "stop"}'
    ;;
  restart)
    curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/power" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"signal": "restart"}'
    ;;
  status)
    curl -X GET "${PANEL_URL}/api/client/servers/${SERVER_UUID}/resources" \
      -H "Authorization: Bearer ${API_KEY}" | jq '.attributes.current_state'
    ;;
  command)
    curl -X POST "${PANEL_URL}/api/client/servers/${SERVER_UUID}/command" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"command\": \"$2\"}"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|command \"your command\"}"
    exit 1
    ;;
esac
```

Usage:
```bash
chmod +x pterodactyl-cli.sh
./pterodactyl-cli.sh start
./pterodactyl-cli.sh command "say Hello"
./pterodactyl-cli.sh status
```

---

## Additional Resources

- [Pterodactyl API Documentation](https://dashflo.net/docs/api/pterodactyl/v1/)
- [Pterodactyl Panel Documentation](https://pterodactyl.io/panel/1.0/getting_started.html)
- [Fabric Server Setup](https://fabricmc.net/use/server/)

