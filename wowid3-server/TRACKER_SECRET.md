# Tracker Secret Configuration

## Generated Secret

Your secure tracker secret has been generated and saved to:
- `wowid3-server/server/.tracker_secret`

**TRACKER_SECRET for Mod Config:**
```
0e4f119f2d6dfb3748277c9fee4478d4b61a13747f77bd2b7fc3bf795c7267ee
```

## Server Configuration

The deploy script will automatically set this secret on the remote server using:
```bash
sudo systemctl set-environment TRACKER_SECRET=<secret>
```

If you need to set it manually, add it to your systemd service file:
```ini
[Service]
Environment="TRACKER_SECRET=0e4f119f2d6dfb3748277c9fee4478d4b61a13747f77bd2b7fc3bf795c7267ee"
```

Or add it to your `.env` file in the server directory:
```
TRACKER_SECRET=0e4f119f2d6dfb3748277c9fee4478d4b61a13747f77bd2b7fc3bf795c7267ee
```

## Mod Configuration

Add this to your Fabric mod's `wowid3-tracker-mod/src/main/resources/wowid3-tracker.properties`:
```properties
tracker.secret=0e4f119f2d6dfb3748277c9fee4478d4b61a13747f77bd2b7fc3bf795c7267ee
```

Or update the `Config.java` file to use this value as the default.

## Security Notes

- Keep this secret secure and never commit it to version control
- The `.tracker_secret` file is already in `.gitignore`
- Regenerate the secret if it's ever compromised using: `python3 gen_secret.py > server/.tracker_secret`

