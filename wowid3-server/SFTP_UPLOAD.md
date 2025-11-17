# SFTP Upload Guide for Pterodactyl Server

## Server Files Package

**File**: `server-files.tar.gz`  
**Size**: 894 MB  
**Location**: `/run/media/james/Dongus/wow-is-dead-3/wowid3-server/server-files.tar.gz`

**Contains**:
- `server.jar` (Fabric server)
- `mods/` (all server mods)
- `config/` (mod configurations)
- `kubejs/` (KubeJS scripts)
- `defaultconfigs/` (default configurations)

---

## SFTP Connection Details

```
Host: wowid.frostdev.io
Port: 9022
Username: james.e8567a7f
Password: [Your Pterodactyl SFTP password]
```

**Get Password**: Pterodactyl Panel → Your Server → Settings → SFTP Details

---

## Upload Methods

### Method 1: Command Line SFTP (Interactive)

```bash
cd /run/media/james/Dongus/wow-is-dead-3/wowid3-server

# Connect to SFTP
sftp -P 9022 james.e8567a7f@wowid.frostdev.io

# Once connected, upload the file
put server-files.tar.gz

# Verify upload
ls -lh server-files.tar.gz

# Exit
bye
```

### Method 2: One-Line scp Command

```bash
cd /run/media/james/Dongus/wow-is-dead-3/wowid3-server

scp -P 9022 server-files.tar.gz \
  james.e8567a7f@wowid.frostdev.io:/home/container/
```

Enter password when prompted.

### Method 3: FileZilla (GUI - Easiest)

1. **Download FileZilla** (if not installed): https://filezilla-project.org/

2. **Open FileZilla** → File → Site Manager → New Site

3. **Enter connection details**:
   - Protocol: `SFTP - SSH File Transfer Protocol`
   - Host: `wowid.frostdev.io`
   - Port: `9022`
   - Logon Type: `Normal`
   - User: `james.e8567a7f`
   - Password: [Your SFTP password]

4. **Connect** → Click OK

5. **Upload**:
   - Left pane: Navigate to `/run/media/james/Dongus/wow-is-dead-3/wowid3-server/`
   - Right pane: Should show `/home/container/`
   - Drag `server-files.tar.gz` from left to right
   - Wait for upload (894 MB will take a few minutes)

### Method 4: Pterodactyl Web Panel (No SFTP Needed)

This is the easiest method if you have panel access:

1. **Log into Pterodactyl Panel**: https://wowid.frostdev.io (or your panel URL)

2. **Go to your server** → Click **Files** tab

3. **Upload file**:
   - Click **Upload** button (top right)
   - Select: `server-files.tar.gz`
   - Wait for upload to complete

4. File will appear in the file list

---

## After Upload - Extract Files

Once `server-files.tar.gz` is uploaded, extract it:

### Via Pterodactyl Console

1. Go to **Console** tab
2. Enter these commands:

```bash
# Extract the tarball
tar -xzf server-files.tar.gz

# Verify files
ls -lh

# Clean up
rm server-files.tar.gz
```

### Expected Output

You should see:
```
server.jar
mods/
config/
kubejs/
defaultconfigs/
eula.txt
server.properties
```

---

## Start the Server

After extracting files:

1. **Go to Console tab**
2. **Click Start button**
3. **Watch for**: `Done (X.XXs)! For help, type "help"`

The server should start successfully!

---

## Troubleshooting

### Connection Refused / Timeout

- Verify port `9022` is correct
- Check firewall isn't blocking the connection
- Try from a different network

### Authentication Failed

- Get correct password from: Panel → Settings → SFTP Details
- Username format: `<username>.<server-id>` (e.g., `james.e8567a7f`)

### Upload Stalls / Slow

- Large file (894 MB) will take time
- Estimated time on typical connection:
  - 100 Mbps: ~2 minutes
  - 50 Mbps: ~4 minutes
  - 25 Mbps: ~8 minutes

### Permission Denied

- Ensure you're uploading to `/home/container/`
- Don't try to upload outside this directory

### File Already Exists

If `server-files.tar.gz` already exists:
```bash
# In console, remove old file:
rm server-files.tar.gz

# Then upload again
```

---

## Alternative: Upload Individual Files

If the tarball is too large, upload files separately:

### 1. Upload just server.jar first

```bash
scp -P 9022 ../wowid3-server-data/server.jar \
  james.e8567a7f@wowid.frostdev.io:/home/container/
```

Start server with just this to verify it works.

### 2. Then upload mods

Create a mods-only tarball:
```bash
cd ../wowid3-server-data
tar -czf mods.tar.gz mods/
```

Upload and extract:
```bash
scp -P 9022 mods.tar.gz james.e8567a7f@wowid.frostdev.io:/home/container/
# Then in console: tar -xzf mods.tar.gz && rm mods.tar.gz
```

### 3. Then configs

```bash
cd ../wowid3-server-data
tar -czf config.tar.gz config/ kubejs/ defaultconfigs/
```

Upload and extract the same way.

---

## Quick Reference Commands

```bash
# Package files
cd /run/media/james/Dongus/wow-is-dead-3/wowid3-server
./scripts/prepare-server-files.sh

# Upload via SFTP
sftp -P 9022 james.e8567a7f@wowid.frostdev.io
put server-files.tar.gz
bye

# Extract on server (in Pterodactyl console)
tar -xzf server-files.tar.gz
rm server-files.tar.gz

# Start server
# Click Start button in panel
```

---

## Support

If you continue having issues:
1. Check Pterodactyl panel for SFTP status
2. Verify node is running
3. Check Wings logs on the node
4. Try uploading via panel instead of SFTP

