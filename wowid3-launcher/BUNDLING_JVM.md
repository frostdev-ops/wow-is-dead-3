# Bundling Azul Zulu JVM 21

This document explains how to bundle the Azul Zulu JVM 21 with the WOWID3 Launcher for a fully self-contained installation.

## Why Azul Zulu?

- **Performance**: Optimized for better performance than OpenJDK
- **Reliability**: Enterprise-grade support and testing
- **Free**: Fully open-source and free to distribute

## Download Links

### Linux x64
- **URL**: https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
- **Size**: ~195 MB
- **SHA256**: (verify on download)

### Windows x64
- **URL**: https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-win_x64.zip
- **Size**: ~190 MB
- **SHA256**: (verify on download)

## Installation Steps

### 1. Download JVM

```bash
# Linux
cd src-tauri
mkdir -p runtime
cd runtime
wget https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
tar -xzf zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
mv zulu21.38.21-ca-jdk21.0.5-linux_x64 java
rm zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz

# Windows (PowerShell)
cd src-tauri
mkdir runtime
cd runtime
Invoke-WebRequest -Uri "https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-win_x64.zip" -OutFile "zulu-jdk.zip"
Expand-Archive -Path "zulu-jdk.zip" -DestinationPath .
Rename-Item -Path "zulu21.38.21-ca-jdk21.0.5-win_x64" -NewName "java"
Remove-Item "zulu-jdk.zip"
```

### 2. Verify Installation

The directory structure should be:
```
src-tauri/
└── runtime/
    └── java/
        ├── bin/
        │   ├── java (Linux) or java.exe (Windows)
        │   └── ... (other JDK tools)
        ├── lib/
        ├── conf/
        └── ... (other JDK files)
```

### 3. Configure Tauri Bundler

The `tauri.conf.json` already includes the runtime directory in bundle resources:

```json
{
  "bundle": {
    "resources": {
      "src-tauri/runtime/**/*": "runtime/"
    }
  }
}
```

This copies the entire `runtime/` directory into the bundled application.

### 4. Test Bundled JVM

```bash
# The minecraft.rs module uses get_bundled_java_path() which returns:
# Linux: ./runtime/java/bin/java
# Windows: ./runtime/java/bin/java.exe

# Test it works:
./runtime/java/bin/java -version
# Should output: openjdk version "21.0.5" ...
```

## Build Process

### Development

During development, the JVM is NOT bundled - the launcher will use system Java if the bundled one isn't found.

```bash
npm run tauri dev
```

### Production Build

When building for production, the Tauri bundler will automatically include the runtime directory:

```bash
# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu

# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc
```

The bundled installers will include:
- **Linux AppImage**: JVM embedded in the AppImage
- **Linux .deb**: JVM installed to `/opt/wowid3-launcher/runtime/java/`
- **Windows NSIS**: JVM installed to `C:\Users\<user>\AppData\Local\wowid3-launcher\runtime\java\`

## Size Considerations

- **JVM Size**: ~195 MB compressed, ~400 MB extracted
- **Total Installer**: ~500-600 MB (including launcher + JVM)
- **Disk Space**: ~800 MB after installation

To minimize size, you could:
1. Use `jlink` to create a minimal JRE (reduces to ~50 MB)
2. Use JVM compression tools
3. Remove unnecessary JDK tools (javac, etc.) - keep only JRE

## Troubleshooting

### JVM Not Found

If the launcher reports "Java runtime not found", check:

1. **Runtime directory exists**:
   ```bash
   ls -la src-tauri/runtime/java/bin/
   ```

2. **Executable permissions** (Linux):
   ```bash
   chmod +x src-tauri/runtime/java/bin/java
   ```

3. **Path in code** (`src/modules/minecraft.rs`):
   ```rust
   fn get_bundled_java_path() -> PathBuf {
       #[cfg(target_os = "windows")]
       { PathBuf::from("./runtime/java/bin/java.exe") }

       #[cfg(not(target_os = "windows"))]
       { PathBuf::from("./runtime/java/bin/java") }
   }
   ```

### Build Failures

If builds fail with "runtime directory not found":

1. Ensure `src-tauri/runtime/java/` exists
2. Check `.gitignore` isn't excluding it (it should be excluded, download locally)
3. Download JVM manually before building
4. Verify `tauri.conf.json` resources section

## Automation Script

For convenience, create `download-jvm.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")/src-tauri"
mkdir -p runtime
cd runtime

PLATFORM=$(uname -s)
if [ "$PLATFORM" = "Linux" ]; then
    echo "Downloading Azul Zulu JVM 21 for Linux..."
    wget https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
    tar -xzf zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
    mv zulu21.38.21-ca-jdk21.0.5-linux_x64 java
    rm zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz
    chmod +x java/bin/java
    echo "JVM installed to $(pwd)/java"
elif [ "$PLATFORM" = "Darwin" ]; then
    echo "macOS not yet supported"
    exit 1
else
    echo "Windows - please run download-jvm.ps1 instead"
    exit 1
fi

./java/bin/java -version
echo "JVM ready!"
```

Make executable:
```bash
chmod +x download-jvm.sh
```

## License

Azul Zulu is distributed under the GPLv2 with Classpath Exception, same as OpenJDK.
You can freely distribute it with your application.

## Updates

To update the JVM:
1. Download new version from Azul
2. Extract to `src-tauri/runtime/java/`
3. Test with `./runtime/java/bin/java -version`
4. Rebuild application

## References

- Azul Zulu Downloads: https://www.azul.com/downloads/?package=jdk#zulu
- Tauri Bundling Guide: https://v2.tauri.app/reference/config/#bundle
- JLink Documentation: https://docs.oracle.com/en/java/javase/21/docs/specs/man/jlink.html
