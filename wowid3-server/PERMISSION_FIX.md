# Critical Permission Issue - Node Administrator Fix Required

## Problem

The Pterodactyl server container user doesn't have permission to read/write files in `/home/container/`. All operations fail with:

```
chmod: changing permissions of './file': Operation not permitted
mkdir: cannot create directory '.fabric': Permission denied
```

## Root Cause

Files in the server directory (`/var/lib/pterodactyl/volumes/{server-uuid}/`) are owned by `root` instead of the container user (typically UID 988). This happens when:

1. Files are uploaded via SFTP with incorrect permissions
2. Wings (Pterodactyl daemon) is misconfigured
3. Manual file operations were done as root on the node

## Solution

### Step 1: Find Your Server UUID

**Via Pterodactyl Panel:**
- Go to your server page
- Look at the URL: `https://panel.com/server/{UUID}`
- Copy the UUID (e.g., `e73e1d58-880f-408b-9ae0-151029d2a80b`)

**Via Node Command:**
```bash
# On the node server
ls -la /var/lib/pterodactyl/volumes/
```

### Step 2: Fix Ownership and Permissions (Root Required)

**SSH into the Pterodactyl node as root:**

```bash
ssh root@wowid.frostdev.io
# Or: ssh your-admin-user@wowid.frostdev.io
# Then: sudo su
```

**Fix the permissions:**

```bash
# Replace {SERVER_UUID} with your actual UUID
SERVER_UUID="e73e1d58-880f-408b-9ae0-151029d2a80b"

# Change ownership to container user (UID 988:988 is default)
chown -R 988:988 /var/lib/pterodactyl/volumes/${SERVER_UUID}

# Set proper permissions
chmod -R 755 /var/lib/pterodactyl/volumes/${SERVER_UUID}

# Verify
ls -la /var/lib/pterodactyl/volumes/${SERVER_UUID}/
```

**Expected output after fix:**
```
drwxr-xr-x 10  988  988  4096 Nov 17 05:00 .
drwxr-xr-x 20 root root  4096 Nov 16 10:00 ..
-rw-r--r--  1  988  988    39 Nov 17 05:00 eula.txt
-rw-r--r--  1  988  988  1234 Nov 17 05:00 server.properties
-rwxr-xr-x  1  988  988   50M Nov 17 05:00 server.jar
drwxr-xr-x  5  988  988  4096 Nov 17 05:00 mods
...
```

### Step 3: Restart Server

After fixing permissions, go back to Pterodactyl panel and start the server.

---

## Alternative: Fix Wings Configuration

If permissions keep breaking, Wings might be misconfigured.

### Check Wings Config

**On the node server:**

```bash
cat /etc/pterodactyl/config.yml
```

**Look for:**
```yaml
system:
  user:
    uid: 988
    gid: 988
    rootless: false
```

### Fix If Needed

**Edit config:**
```bash
nano /etc/pterodactyl/config.yml
```

**Ensure these values:**
```yaml
remote: docker
system:
  user:
    rootless: false
    uid: 988
    gid: 988
  detect_clean_exit: true
  sftp:
    bind_port: 2022
```

**Restart Wings:**
```bash
systemctl restart wings
systemctl status wings
```

---

## Prevent Future Issues

### Method 1: Upload via Panel (Recommended)

1. Delete all files in the server (via panel)
2. Re-upload via Pterodactyl panel's **Files** tab
3. Panel uploads automatically set correct ownership

### Method 2: Fix SFTP Uploads

If using SFTP, Wings should automatically fix permissions. If it doesn't:

**Check Wings logs:**
```bash
journalctl -u wings -f
```

Look for permission-related errors when uploading via SFTP.

### Method 3: Post-Upload Fix Script

Create a script on the node that runs after uploads:

**`/usr/local/bin/fix-pterodactyl-perms.sh`:**
```bash
#!/bin/bash
# Fix permissions for all Pterodactyl servers
for dir in /var/lib/pterodactyl/volumes/*; do
    if [ -d "$dir" ]; then
        chown -R 988:988 "$dir"
        chmod -R 755 "$dir"
    fi
done
```

**Make executable:**
```bash
chmod +x /usr/local/bin/fix-pterodactyl-perms.sh
```

**Run after uploads:**
```bash
/usr/local/bin/fix-pterodactyl-perms.sh
```

---

## Verification

After fixing permissions, test:

1. **Start the server** - should not get permission errors
2. **Check console output** - should show Java starting properly
3. **Create a file via console:**
   ```bash
   touch test.txt
   echo "test" > test.txt
   cat test.txt
   ```
   Should work without errors.

---

## Common Mistakes

❌ **Don't do this:**
```bash
# This makes all files root-owned (bad!)
sudo cp files /var/lib/pterodactyl/volumes/...
```

✅ **Do this instead:**
```bash
# Copy as root, then fix ownership
sudo cp files /var/lib/pterodactyl/volumes/{uuid}/
sudo chown -R 988:988 /var/lib/pterodactyl/volumes/{uuid}/
```

❌ **Don't do this:**
```bash
# Changing container user UID breaks things
usermod -u 1000 container
```

✅ **Do this instead:**
```bash
# Keep container at 988, fix file ownership to match
chown -R 988:988 /var/lib/pterodactyl/volumes/
```

---

## Quick Fix Commands

**One-liner to fix all servers on a node:**
```bash
find /var/lib/pterodactyl/volumes -mindepth 1 -maxdepth 1 -type d -exec chown -R 988:988 {} \; -exec chmod -R 755 {} \;
```

**Fix specific server:**
```bash
SERVER_UUID="your-uuid-here"
chown -R 988:988 /var/lib/pterodactyl/volumes/${SERVER_UUID}
chmod -R 755 /var/lib/pterodactyl/volumes/${SERVER_UUID}
```

**Verify specific server:**
```bash
SERVER_UUID="your-uuid-here"
ls -la /var/lib/pterodactyl/volumes/${SERVER_UUID}/ | head -20
```

---

## Contact Server Admin

If you don't have root access to the node server, contact your Pterodactyl server administrator with this information:

**Message Template:**
```
Hi,

My Minecraft server (UUID: {your-uuid}) is experiencing permission issues.
The container user can't read/write files in /home/container/.

Can you please run these commands on the node server:

chown -R 988:988 /var/lib/pterodactyl/volumes/{your-uuid}
chmod -R 755 /var/lib/pterodactyl/volumes/{your-uuid}

This is a known issue when files are uploaded with incorrect ownership.

Thanks!
```

---

## Additional Resources

- [Pterodactyl Discord](https://discord.gg/pterodactyl) - #support-wings channel
- [Pterodactyl GitHub](https://github.com/pterodactyl/wings/issues)
- [Wings Documentation](https://pterodactyl.io/wings/1.0/installing.html)

