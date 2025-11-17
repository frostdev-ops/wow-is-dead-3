# Pterodactyl Egg Troubleshooting Guide

## Network Binding Error (Exit Code 128)

### Error Message
```
failed to bind port 162.216.16.218:25565/tcp: Error starting userland proxy: 
listen tcp4 162.216.16.218:25565: bind: cannot assign requested address
```

### Cause
The allocation is configured with an IP address that doesn't exist or isn't available on the node.

### Solution

#### Option 1: Fix the Allocation (Recommended)

1. **Check Node IP Addresses**:
   ```bash
   # On the Pterodactyl node, check available IPs
   ip addr show
   # or
   hostname -I
   ```

2. **Update Allocation in Admin Panel**:
   - Go to **Admin Panel** → **Nodes** → [Your Node]
   - Click **Allocation** tab
   - Find the allocation with IP `162.216.16.218`
   - Either:
     - **Delete it** if the IP is wrong
     - **Update it** to a valid IP from step 1

3. **Create New Allocation with Correct IP**:
   - In the Allocations tab, click **Create New**
   - Enter a valid IP address (e.g., `0.0.0.0` for all interfaces, or your node's actual IP)
   - Enter port: `25565`
   - Click **Submit**

4. **Assign New Allocation to Server**:
   - Go to **Admin Panel** → **Servers** → [Your Server]
   - Click **Build Configuration** tab
   - Under **Default Allocation**, select the new allocation
   - Click **Update Build Configuration**

#### Option 2: Use 0.0.0.0 (All Interfaces)

Create an allocation with `0.0.0.0` as the IP:

**Via Panel:**
1. Admin Panel → Nodes → [Node] → Allocation
2. IP Address: `0.0.0.0`
3. Ports: `25565`
4. Click Assign

**Via API:**
```bash
NODE_ID="1"
PANEL_URL="https://your-panel.com"
API_KEY="your_api_key"

curl -X POST "${PANEL_URL}/api/application/nodes/${NODE_ID}/allocations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "0.0.0.0",
    "ports": ["25565"]
  }'
```

#### Option 3: Use Node's Actual IP

Find your node's IP and create allocation:

```bash
# On the node server
NODE_IP=$(hostname -I | awk '{print $1}')
echo "Node IP: $NODE_IP"

# Then create allocation with this IP via admin panel
```

### Prevention

Always ensure allocations use IPs that are:
- Actually assigned to the network interface
- Not already in use by other services
- Accessible from the network you want to serve

---

## Server Won't Start (Exit Code 1)

### Check Java Version

The egg requires Java 21+. Verify in the Docker image:

```bash
# In server console, send command:
java -version
```

### Check server.jar Exists

Verify the file via Files tab or console:

```bash
# In console:
ls -lh server.jar
```

If missing, upload from `wowid3-server-data/server.jar`.

---

## Out of Memory (OOM)

### Symptoms
- Server crashes during startup
- "OutOfMemoryError" in logs
- Exit code 137

### Solutions

1. **Increase Memory Allocation**:
   - Admin Panel → Servers → [Server] → Build Configuration
   - Increase **Memory Limit** (recommend 4096 MB minimum for modded)
   - Update **Startup Variables**:
     - `MIN_MEMORY`: Match memory limit
     - `MAX_MEMORY`: Match memory limit

2. **Optimize JVM Arguments**:
   The egg already includes optimized args. Don't change unless you know what you're doing.

3. **Reduce Server Load**:
   - Lower `view-distance` (default: 10 → try 8)
   - Lower `simulation-distance` (default: 10 → try 8)
   - Remove unnecessary mods

---

## Port Already in Use

### Error
```
Failed to bind to port
Port already in use
```

### Solutions

1. **Stop Conflicting Server**:
   - Check if another server is using port 25565
   - Stop it or assign a different port

2. **Change Server Port**:
   - Edit `SERVER_PORT` startup variable
   - Or manually edit `server.properties`:
     ```properties
     server-port=25566
     ```

3. **Check Node Allocations**:
   - Ensure the port isn't assigned to multiple servers
   - Admin Panel → Nodes → [Node] → Allocation

---

## Docker Image Pull Failed

### Error
```
Failed pulling Docker container image
Image not found
```

### Solutions

1. **Check Docker Image Name**:
   The egg uses: `ghcr.io/pterodactyl/yolks:java_21`
   
2. **Verify Node Can Pull Images**:
   ```bash
   # On the node server
   docker pull ghcr.io/pterodactyl/yolks:java_21
   ```

3. **Use Alternative Image**:
   - Go to server Startup tab
   - Change Docker Image to: `ghcr.io/pterodactyl/yolks:java_17`
   - Note: Requires Java 17+ for Minecraft 1.20.1

---

## Server Keeps Crashing on Startup

### Check Console Logs

Look for error patterns:

**Missing mod dependencies:**
```
net.fabricmc.loader.impl.FormattedException: 
Mod 'X' requires mod 'Y'
```
→ Add missing dependency mods

**Incompatible mods:**
```
Incompatible mods found!
```
→ Check mod versions match Minecraft 1.20.1

**Config errors:**
```
Failed to load config
```
→ Delete or fix the problematic config file

### Common Fixes

1. **Clear Old Files**:
   ```bash
   # In console or via Files tab, remove:
   rm -rf world/ logs/
   ```

2. **Reinstall Server**:
   - Go to server Settings tab
   - Click **Reinstall Server**
   - This runs the installation script again

3. **Check File Permissions**:
   ```bash
   # In console:
   chmod -R 755 .
   ```

---

## Installation Script Failed

### Error During Installation

If the installation script fails:

1. **Check Installation Logs**:
   - View full output in Pterodactyl console during installation

2. **Common Issues**:
   - Java not available in Docker image → Use correct image
   - Permissions errors → Fixed automatically by script
   - Network timeout → Retry installation

3. **Manual Installation**:
   - Skip automatic installation
   - Upload files manually via SFTP/File Manager
   - Create `eula.txt` with content: `eula=true`

---

## Variables Not Applied

### Server Properties Not Updating

If changing variables doesn't update `server.properties`:

1. **Restart Server**:
   - Variables are applied on server start
   - Stop and start (not just restart)

2. **Check server.properties**:
   - View via Files tab
   - Ensure it exists and is writable

3. **Manually Edit**:
   - Edit `server.properties` directly if auto-update fails
   - Changes persist unless overwritten by egg

---

## Performance Issues

### Low TPS (Ticks Per Second)

**Check TPS in-game:**
```
/forge tps
# or
/carpet tps
```

Normal: 20 TPS
Lagging: < 18 TPS

### Optimization Steps

1. **Memory**:
   - Ensure MIN_MEMORY = MAX_MEMORY (prevents resizing)
   - Minimum 4 GB for modded, 6-8 GB recommended

2. **CPU Allocation**:
   - Admin Panel → Server → Build → CPU Limit
   - Set to at least 200% (2 cores)

3. **Server Settings**:
   - Lower view-distance: 8-10 chunks
   - Lower simulation-distance: 6-8 chunks
   - Lower max-players if needed

4. **Mods**:
   - Add performance mods:
     - Lithium (general optimization)
     - FerriteCore (memory optimization)
     - C2ME (chunk loading)
   - Remove laggy mods

5. **JVM Args**:
   The egg already includes optimized arguments. Default:
   ```
   -XX:+UseG1GC
   -XX:+UnlockExperimentalVMOptions
   -XX:G1NewSizePercent=20
   -XX:G1ReservePercent=20
   -XX:MaxGCPauseMillis=50
   -XX:G1HeapRegionSize=32M
   -XX:+ParallelRefProcEnabled
   -XX:+DisableExplicitGC
   -XX:+AlwaysPreTouch
   ```

---

## Cannot Connect to Server

### Check Server Status

1. **Is Server Running?**
   - Check Pterodactyl panel status
   - Look for "Done" message in console

2. **Check Firewall**:
   ```bash
   # On node server
   sudo ufw status
   sudo ufw allow 25565/tcp
   ```

3. **Check Allocation**:
   - Verify allocation is assigned to server
   - Ensure port matches what clients are connecting to

4. **Test Connectivity**:
   ```bash
   # From another machine
   telnet your-server-ip 25565
   # or
   nc -zv your-server-ip 25565
   ```

### Check online-mode

If getting "Failed to verify username":
- Set `SERVER_ONLINE_MODE=false` for offline/cracked
- Or ensure players have legitimate Minecraft accounts

---

## Quick Diagnostics Checklist

When server won't start, check:

- [ ] Docker image pulled successfully
- [ ] Allocation exists and uses valid IP
- [ ] Port not in use by another service
- [ ] Memory allocation sufficient (4+ GB)
- [ ] `server.jar` file exists
- [ ] `eula.txt` exists with `eula=true`
- [ ] Java 21 available in container
- [ ] No mod conflicts or missing dependencies
- [ ] File permissions correct (755 for dirs, 644 for files)

## Getting Help

If issues persist:

1. **Check Console Logs**: Full output usually shows the exact problem
2. **Check Pterodactyl Logs**: On node server at `/var/log/pterodactyl/`
3. **Community Support**:
   - [Pterodactyl Discord](https://discord.gg/pterodactyl)
   - [Pterodactyl GitHub Issues](https://github.com/pterodactyl/panel/issues)
4. **Provide Details**:
   - Pterodactyl version
   - Node OS and Docker version
   - Full error message/logs
   - Egg configuration

