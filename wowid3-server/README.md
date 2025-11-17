# WOWID3 Pterodactyl Egg - Fabric Modded Minecraft Server

A high-performance Pterodactyl egg for running Fabric modded Minecraft servers with bundled Zulu 21 Java runtime. This egg is optimized for modded servers with performance-tuned JVM arguments.

## Overview

This project provides a complete Pterodactyl egg configuration for Fabric modded Minecraft servers. The egg includes:

- **Bundled Zulu 21 Java**: Ensures consistent Java 21 runtime across all deployments
- **Performance Optimized**: G1GC with tuned parameters specifically for modded Minecraft servers
- **Fabric Support**: Optimized startup and configuration for Fabric loader
- **Production Ready**: Proper shutdown handling, log management, and file parsing

## Project Structure

```
wowid3-server/
├── eggs/
│   └── fabric-server.json    # Main Pterodactyl egg JSON
├── docker/
│   └── Dockerfile            # Custom Docker image with Zulu 21
├── scripts/
│   ├── install.sh            # Installation script for server setup
│   ├── build-docker.sh       # Build and push Docker image
│   └── export-egg.sh         # Validate and format egg JSON
├── docker-compose.yml        # Local Docker testing
├── .gitignore               # Git ignore patterns
└── README.md               # This file
```

## Quick Start

### 1. Import Egg into Pterodactyl

#### Via Admin Panel (Recommended)

1. Log into your Pterodactyl Admin Panel
2. Navigate to **Nests** → Select or create a nest
3. Click **Import Egg**
4. Upload or paste the contents of `eggs/fabric-server.json`
5. Save the egg

#### Via API

You can also import the egg programmatically using the Pterodactyl API:

```bash
curl -X POST https://your-panel.com/api/application/nests/{nest-id}/eggs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @eggs/fabric-server.json
```

### 2. Build Docker Image (Optional)

If you want to use a custom Docker image with Zulu 21 Java:

```bash
# Build the image
./scripts/build-docker.sh

# Or with custom name/tag
IMAGE_NAME=your-registry/fabric-server IMAGE_TAG=v1.0.0 ./scripts/build-docker.sh

# Push to registry
PUSH_IMAGE=true ./scripts/build-docker.sh
```

Then update the `docker_image` field in the egg JSON to use your custom image.

### 3. Create Server

1. In Pterodactyl Panel, go to **Servers** → **Create New**
2. Select the **Fabric Server** egg
3. Configure server settings (memory, CPU, disk, etc.)
4. The installation script will run automatically on first start

## Configuration

### Egg Variables

The egg includes the following configurable variables:

| Variable | Description | Default | Editable |
|----------|-------------|---------|----------|
| `SERVER_JARFILE` | Server JAR file name | `server.jar` | Yes |
| `JVM_ARGS` | JVM arguments for performance | Optimized G1GC settings | Admin only |
| `MIN_MEMORY` | Minimum heap size (MB) | `{{SERVER_MEMORY}}` | Yes |
| `MAX_MEMORY` | Maximum heap size (MB) | `{{SERVER_MEMORY}}` | Yes |
| `SERVER_MAX_PLAYERS` | Maximum players | `20` | Yes |
| `SERVER_VIEW_DISTANCE` | View distance (chunks) | `10` | Yes |
| `SERVER_SIMULATION_DISTANCE` | Simulation distance (chunks) | `10` | Yes |
| `SERVER_DIFFICULTY` | Server difficulty | `easy` | Yes |
| `SERVER_HARDCORE` | Hardcore mode | `false` | Yes |
| `SERVER_PVP` | PvP enabled | `true` | Yes |
| `SERVER_ONLINE_MODE` | Online mode (Mojang auth) | `true` | Yes |
| `SERVER_WHITELIST` | Whitelist enabled | `false` | Yes |
| `SERVER_MOTD` | Message of the day | `A Minecraft Server` | Yes |

### Server JAR File

The egg expects a `server.jar` file in the server directory. You can:

1. Upload it via the Pterodactyl file manager
2. Use the installation script to verify it exists
3. Change the `SERVER_JARFILE` variable if using a different name

**Note**: The server.jar should be a Fabric server JAR. You can download Fabric server installers from [fabricmc.net](https://fabricmc.net/use/server/).

### Performance Tuning

#### Default JVM Arguments

The egg includes optimized JVM arguments for modded servers:

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
-Dfile.encoding=UTF-8
-Duser.country=US
-Duser.language=en
```

#### Memory Allocation

For modded servers, recommended memory allocation:

- **Small server (1-5 players)**: 2-4 GB
- **Medium server (5-15 players)**: 4-8 GB
- **Large server (15+ players)**: 8-16 GB

Set `MIN_MEMORY` and `MAX_MEMORY` to the same value for best performance (prevents heap resizing).

#### View/Simulation Distance

Lower values improve performance:
- **View Distance**: 6-10 chunks (default: 10)
- **Simulation Distance**: 6-10 chunks (default: 10)

## Docker Image

### Using Default Image

The egg uses `ghcr.io/pterodactyl/yolks:java_21` by default, which includes Java 21.

### Building Custom Image

To build a custom Docker image with Zulu 21 Java:

```bash
cd docker
docker build -t your-registry/fabric-server:latest .
```

Or use the build script:

```bash
./scripts/build-docker.sh
```

The Dockerfile installs:
- Ubuntu 22.04 base
- Zulu 21 OpenJDK from Azul Systems
- Proper environment variables
- Container user setup for Pterodactyl

### Testing Docker Image Locally

Use `docker-compose.yml` to test the image:

```bash
docker-compose up
```

## Scripts

### Installation Script

The `scripts/install.sh` script:

- Verifies Java 21+ installation
- Checks for server.jar
- Creates necessary directories
- Sets up EULA acceptance
- Creates default server.properties
- Sets proper file permissions

Run manually if needed:

```bash
./scripts/install.sh
```

### Build Docker Script

Build and optionally push Docker images:

```bash
# Build only
./scripts/build-docker.sh

# Build and push
PUSH_IMAGE=true ./scripts/build-docker.sh

# Custom image name
IMAGE_NAME=myregistry/fabric-server IMAGE_TAG=v1.0 ./scripts/build-docker.sh
```

### Export/Validate Egg Script

Validate and format the egg JSON:

```bash
./scripts/export-egg.sh eggs/fabric-server.json
```

Requires `jq` for full validation:

```bash
sudo apt-get install jq  # Debian/Ubuntu
brew install jq           # macOS
```

## Troubleshooting

### Server Won't Start

1. **Check Java version**: Ensure Java 21+ is installed
   ```bash
   java -version
   ```

2. **Verify server.jar exists**: Check the file manager in Pterodactyl

3. **Check logs**: View server logs in Pterodactyl panel

4. **Verify EULA**: Ensure `eula.txt` exists with `eula=true`

### Out of Memory Errors

- Increase `MAX_MEMORY` variable
- Reduce view/simulation distance
- Lower max players
- Check for memory leaks in mods

### Performance Issues

- Ensure `MIN_MEMORY` equals `MAX_MEMORY`
- Lower view/simulation distance
- Check server tick rate: `/forge tps` or `/carpet tps`
- Review mod list for performance-heavy mods

### Java Not Found

If you see "Java not found" errors:

1. Verify Docker image has Java installed
2. Check `JAVA_HOME` environment variable
3. Rebuild Docker image if using custom image

## Integration with WOWID3 Launcher

This egg is designed to work with the WOWID3 launcher ecosystem. The server.jar should be compatible with the modpack used by the launcher.

The server data directory (`wowid3-server-data`) contains:
- `server.jar`: The Fabric server JAR file
- `mods/`: Server-side mods
- `config/`: Server configuration files
- `world/`: Server world data

## Development

### Modifying the Egg

1. Edit `eggs/fabric-server.json`
2. Validate with: `./scripts/export-egg.sh eggs/fabric-server.json`
3. Re-import into Pterodactyl panel

### Testing Changes

1. Build/test Docker image locally: `docker-compose up`
2. Test installation script: `./scripts/install.sh`
3. Create a test server in Pterodactyl

## Performance Optimization Tips

1. **Use G1GC**: Already configured in default JVM args
2. **Match min/max memory**: Prevents heap resizing overhead
3. **Lower view distance**: Reduces chunk loading
4. **Optimize mods**: Remove unnecessary or performance-heavy mods
5. **Use performance mods**: Consider adding server-side performance mods like:
   - Lithium (server optimizations)
   - FerriteCore (memory optimizations)
   - C2ME (chunk loading optimizations)

## License

This project is part of the WOWID3 launcher ecosystem.

## References

- [Pterodactyl Documentation](https://pterodactyl.io/)
- [Fabric Server Setup](https://fabricmc.net/use/server/)
- [Azul Zulu Java](https://www.azul.com/products/zulu-community/)
- [Minecraft Server Optimization](https://minecraft.wiki/w/Server_performance)
