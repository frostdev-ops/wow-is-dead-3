# Launcher Customization Guide

This guide explains how to customize your launcher's branding, appearance, and behavior using the built-in CMS (Content Management System).

## Table of Contents

1. [Accessing the CMS](#accessing-the-cms)
2. [Branding Configuration](#branding-configuration)
3. [Server Settings](#server-settings)
4. [UI Configuration](#ui-configuration)
5. [Performance Settings](#performance-settings)
6. [Feature Flags](#feature-flags)
7. [Asset Management](#asset-management)
8. [Theme Customization](#theme-customization)
9. [API Endpoints](#api-endpoints)
10. [Best Practices](#best-practices)

## Accessing the CMS

1. Log in to your admin panel at `https://your-server.com:5565/login`
2. Navigate to "CMS" in the sidebar
3. Make your changes in the various tabs
4. Click "Save Changes" to apply

**Important**: Changes take effect the next time the launcher fetches the configuration. Users may need to restart the launcher to see updates.

## Branding Configuration

Customize your launcher's identity and links.

### Fields

- **Application Name**: The name displayed in the launcher window title
  - Default: `WOWID3 Launcher`
  - Example: `My Awesome Modpack`

- **Tagline**: Subtitle or slogan for your launcher
  - Default: `Modded Minecraft Made Easy`
  - Example: `The Ultimate Adventure Awaits`

- **Logo URL**: Path to your custom logo image
  - Format: `/api/cms/assets/filename.png`
  - Upload logos in the Assets tab first
  - Recommended size: 256x256px (PNG with transparency)

- **Favicon URL**: Path to your custom favicon
  - Format: `/api/cms/assets/favicon.ico`
  - Recommended size: 32x32px or 64x64px

- **Discord Server URL**: Link to your Discord community
  - Example: `https://discord.gg/your-invite`
  - Displayed in the launcher UI

- **Website URL**: Link to your main website
  - Example: `https://your-server.com`
  - Displayed in the launcher UI

## Server Settings

Configure default server and modpack settings.

### Fields

- **Default Minecraft Server**: The server address users connect to
  - Format: `hostname:port` or `ip:port`
  - Example: `mc.myserver.com:25565`

- **Manifest URL**: URL to your modpack manifest
  - Default: `https://wowid-launcher.frostdev.io/api/manifest/latest`
  - Must be a valid HTTPS URL
  - The launcher uses this to check for modpack updates

- **Minecraft Version**: Required Minecraft version
  - Example: `1.20.1`
  - Must match your modpack requirements

- **Fabric Loader Version**: Required Fabric loader version
  - Example: `0.15.0`
  - Must match your modpack requirements

- **Fabric Required**: Whether Fabric is mandatory
  - Toggle: On/Off
  - Set to ON for modpacks that require Fabric

## UI Configuration

Control the launcher's user interface behavior.

### Fields

- **Default Theme**: The theme shown on first launch
  - Options: `christmas`, `dark`, `light`, or custom theme IDs
  - Default: `christmas`

- **Available Themes**: Comma-separated list of theme IDs
  - Example: `christmas, dark, light, custom-ocean`
  - Only listed themes appear in the theme selector

- **Default Volume**: Default music volume (0-100%)
  - Slider: 0% to 100%
  - Default: 50%

- **Show Discord Toggle**: Allow users to enable/disable Discord Rich Presence
  - Toggle: On/Off
  - Recommended: ON

- **Show Music Toggle**: Allow users to control background music
  - Toggle: On/Off
  - Recommended: ON

## Performance Settings

Configure resource allocation and system behavior.

### Memory Allocation

- **Default RAM (MB)**: Default memory allocation
  - Default: 16384 (16GB)
  - Adjust based on your modpack's requirements

- **Minimum RAM (MB)**: Minimum allowed allocation
  - Default: 2048 (2GB)
  - Prevents users from setting too little memory

- **Maximum RAM (MB)**: Maximum allowed allocation
  - Default: 32768 (32GB)
  - Prevents users from setting too much memory

### Polling Intervals (milliseconds)

Control how often the launcher checks various services:

- **Server Status**: How often to ping the Minecraft server
  - Default: 30000 (30 seconds)
  - Lower values = more network traffic

- **Tracker Status**: How often to check player tracker
  - Default: 60000 (60 seconds)

- **Health Check**: How often to check if the game is running
  - Default: 5000 (5 seconds)

- **Update Check**: How often to check for modpack updates
  - Default: 300000 (5 minutes)

### Retry Configuration

- **Max Attempts**: Maximum retry attempts for failed operations
  - Default: 5

- **Base Delay (ms)**: Initial delay before first retry
  - Default: 1000 (1 second)

### Download Configuration

- **Max Concurrent Downloads**: Number of simultaneous downloads
  - Default: 4
  - Higher values = faster downloads but more bandwidth

- **Chunk Size (bytes)**: Size of download chunks
  - Default: 1048576 (1MB)
  - Larger chunks = fewer HTTP requests

## Feature Flags

Enable or disable launcher features.

### Available Features

- **Discord Rich Presence**: Show game activity on Discord
  - Displays server name, player count, and session time
  - Recommended: ON

- **Statistics Tracking**: Track and display player statistics
  - Collects gameplay statistics via server mod
  - Recommended: ON

- **Map Viewer**: In-launcher map viewing (BlueMap integration)
  - Requires BlueMap server setup
  - Default: ON

- **Auto Update**: Automatically check and download updates
  - Recommended: ON for seamless experience

- **Crash Reporting**: Send crash reports for debugging
  - Helps developers identify issues
  - Default: OFF (privacy)

- **Telemetry**: Send anonymous usage data
  - Helps improve the launcher
  - Default: OFF (privacy)

## Asset Management

Upload and manage custom assets for your launcher.

### Supported File Types

- **Images**: PNG, JPG, GIF, WebP, SVG, ICO, BMP
- **Audio**: MP3, WAV, OGG, FLAC, AAC, M4A
- **Fonts**: WOFF, WOFF2, TTF, OTF
- **Other**: Any file type for custom assets

### Uploading Assets

1. Navigate to the "Assets" tab
2. Click "Choose Files" or drag files into the upload area
3. Wait for upload to complete
4. Copy the asset URL using the "Copy URL" button
5. Use the URL in other configuration fields

### Asset References

- **Menu Music**: Main background music file
  - Format: `/api/cms/assets/filename.mp3`
  - Plays in launcher main menu

- **Menu Music (Fallback)**: Alternative background music
  - Used if main music fails to load

### Asset URLs

All uploaded assets are accessible at:
```
https://your-server.com:5565/api/cms/assets/filename.ext
```

Use these URLs in theme configurations, branding settings, or custom code.

## Theme Customization

Create custom visual themes for your launcher.

### Creating a New Theme

1. Go to the "Themes" tab
2. Click "New Theme" to create a blank theme
3. Or click "Duplicate" to copy an existing theme
4. Configure all theme properties
5. Click "Save Changes"

### Theme Properties

#### Basic Information

- **Theme ID**: Unique identifier (e.g., `custom-ocean`)
  - Must be unique across all themes
  - Use lowercase letters, numbers, and hyphens only

- **Theme Name**: Display name (e.g., `Ocean Theme`)
  - Shown in the theme selector

#### Color Palette

Configure all UI colors using hex color codes:

- **Primary**: Main brand color
- **Secondary**: Secondary brand color
- **Accent**: Accent/highlight color
- **Background**: Main background color
- **Surface**: Card/panel background color
- **Text**: Primary text color
- **Text Secondary**: Secondary/muted text color
- **Border**: Border and divider color
- **Success**: Success state color (green)
- **Warning**: Warning state color (orange)
- **Error**: Error state color (red)
- **Info**: Info state color (blue)

**Tips**:
- Use a color picker tool to find hex codes
- Ensure sufficient contrast between text and background
- Test themes on both light and dark monitors

#### Background

- **Background Type**: How the background is rendered
  - `solid`: Single color
  - `gradient`: CSS gradient
  - `image`: Background image
  - `animated`: Animated effect (e.g., snow, particles)

- **Background Color**: Base background color (hex)

- **Background Image** (if type = image):
  - URL to background image
  - Upload image to Assets first
  - Recommended: High-resolution (1920x1080+)

- **Animation Type** (if type = animated):
  - Built-in animations: `snow`, `particles`
  - Custom animations require code changes

#### Typography

- **Font Family**: Main font stack
  - Example: `Inter, system-ui, -apple-system, sans-serif`
  - Use web-safe fonts or upload custom fonts

- **Heading Font**: Font for headings
  - Can be same as main font or different

- **Base Font Size**: Default font size
  - Example: `16px`

- **Normal Weight**: Normal font weight
  - Standard: 400

- **Bold Weight**: Bold font weight
  - Standard: 600 or 700

#### Animations

- **Enable Animations**: Toggle animations on/off
  - Disable for better performance on low-end systems

- **Transition Speed**: Speed of transitions
  - Example: `300ms`

- **Animation Timing**: Easing function
  - Example: `ease-in-out`

### Example Theme

```json
{
  "id": "custom-ocean",
  "name": "Ocean Theme",
  "colors": {
    "primary": "#0ea5e9",
    "secondary": "#06b6d4",
    "accent": "#22d3ee",
    "background": "#0c4a6e",
    "surface": "#075985",
    "text": "#f0f9ff",
    "textSecondary": "#bae6fd",
    "border": "#0369a1",
    "success": "#10b981",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "info": "#3b82f6"
  },
  "background": {
    "type": "gradient",
    "color": "#0c4a6e",
    "gradient": "linear-gradient(to bottom, #0c4a6e, #082f49)",
    "image": null,
    "animation": null
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "headingFont": "Inter, system-ui, sans-serif",
    "fontSizeBase": "16px",
    "fontWeightNormal": 400,
    "fontWeightBold": 600
  },
  "animations": {
    "enableAnimations": true,
    "transitionSpeed": "300ms",
    "animationTiming": "ease-in-out"
  }
}
```

## API Endpoints

The CMS system exposes several API endpoints.

### Public Endpoints (No Authentication)

#### Get CMS Configuration
```
GET /api/cms/config
```

Returns the complete CMS configuration for launcher consumption.

**Response**: JSON object with all configuration

#### Get Asset File
```
GET /api/cms/assets/:filename
```

Serves an uploaded asset file.

**Example**: `GET /api/cms/assets/logo.png`

### Admin Endpoints (Requires Authentication)

Add the `Authorization: Bearer <token>` header to all requests.

#### Get CMS Configuration (Admin)
```
GET /api/admin/cms/config
```

Same as public endpoint but requires authentication.

#### Update CMS Configuration
```
PUT /api/admin/cms/config
```

Update configuration (partial updates supported).

**Body**:
```json
{
  "branding": {
    "appName": "My Custom Launcher"
  }
}
```

#### Reset CMS Configuration
```
POST /api/admin/cms/config/reset
```

Reset all configuration to defaults.

#### List Assets
```
GET /api/admin/cms/assets
```

List all uploaded assets with metadata.

**Response**:
```json
{
  "assets": [
    {
      "filename": "logo.png",
      "size": 12345,
      "mimeType": "image/png",
      "uploadedAt": 1234567890,
      "category": "image"
    }
  ]
}
```

#### Upload Asset
```
POST /api/admin/cms/assets
```

Upload a new asset file.

**Body**: `multipart/form-data` with `file` field

**Response**:
```json
{
  "filename": "logo.png",
  "url": "https://your-server.com/api/cms/assets/logo.png",
  "metadata": { ... }
}
```

#### Delete Asset
```
DELETE /api/admin/cms/assets/:filename
```

Delete an uploaded asset.

**Example**: `DELETE /api/admin/cms/assets/old-logo.png`

## Best Practices

### General

1. **Always test changes**: Test configuration changes with the launcher before deploying to users
2. **Backup configuration**: Export and save your CMS configuration regularly
3. **Use version control**: Keep track of configuration changes
4. **Document customizations**: Note why specific settings were chosen

### Branding

1. **Consistent branding**: Use consistent colors, logos, and messaging
2. **Optimize images**: Compress logos and backgrounds for faster loading
3. **Test readability**: Ensure text is readable on all themes
4. **Mobile consideration**: While this is a desktop app, keep UI elements clear

### Performance

1. **Conservative RAM defaults**: Don't set default RAM too high (most users have 8-16GB total)
2. **Reasonable polling**: Don't poll too frequently (increases server load)
3. **Asset optimization**: Compress audio files (MP3 128-192kbps is fine for background music)
4. **Lazy loading**: Don't load all assets at startup

### Themes

1. **Accessibility**: Ensure good contrast ratios (WCAG AA minimum)
2. **Test on multiple monitors**: Check themes on different screen types
3. **Provide variety**: Offer both dark and light themes
4. **Keep it simple**: Don't overcomplicate color schemes

### Assets

1. **Use appropriate formats**:
   - PNG for logos (transparency support)
   - JPG for photos/backgrounds
   - SVG for icons (scalable)
   - MP3 for audio (best compatibility)

2. **Optimize file sizes**:
   - Images: Use compression tools (TinyPNG, etc.)
   - Audio: Use 128-192kbps MP3 for music
   - Keep total assets under 50MB if possible

3. **Naming conventions**: Use descriptive, URL-safe filenames
   - Good: `logo-2024.png`, `main-theme-music.mp3`
   - Bad: `image (1).png`, `My Audio File!.mp3`

### Deployment

1. **Staging environment**: Test changes in a staging environment first
2. **Gradual rollout**: Consider rolling out major changes gradually
3. **User communication**: Notify users about major visual changes
4. **Rollback plan**: Keep previous configuration backups for rollback

### Maintenance

1. **Regular updates**: Keep asset references up to date
2. **Clean up unused assets**: Delete old assets to save disk space
3. **Monitor performance**: Check server logs for CMS-related issues
4. **User feedback**: Collect feedback on customization changes

## Troubleshooting

### Configuration Not Updating

1. Check that you clicked "Save Changes"
2. Wait 5 minutes (config is cached for 5 minutes)
3. Restart the launcher to force a config refresh
4. Check browser console for errors

### Assets Not Loading

1. Verify the asset URL is correct
2. Check that the file was uploaded successfully
3. Ensure the asset exists on the server (`/api/cms/assets/filename`)
4. Check server logs for 404 errors

### Theme Not Appearing

1. Verify the theme ID is in the "Available Themes" list
2. Check that the theme is saved in the CMS configuration
3. Ensure there are no JSON syntax errors in the theme
4. Try selecting the theme manually in the launcher

### Performance Issues

1. Reduce polling intervals if server load is high
2. Optimize asset file sizes
3. Disable unnecessary features
4. Check server resource usage

## Support

For additional help:
- Check the main `CLAUDE.md` documentation
- Review server logs in `/var/log/wowid3-server/`
- Check the GitHub repository for issues and updates
- Contact your server administrator

## Advanced Topics

### Custom Fonts

1. Upload font files to Assets (WOFF2 recommended)
2. Create CSS that references the font URLs
3. Update theme typography to use custom font family
4. Note: Requires code changes to load custom CSS

### Dynamic Themes

The CMS supports any number of custom themes. Users can:
- Select themes from a dropdown in the launcher
- Themes are applied immediately without restart
- Theme preferences are saved per-user

### Asset CDN Integration

For large deployments, consider:
- Using a CDN to serve assets
- Uploading assets to the CMS, then copying to CDN
- Updating asset URLs to point to CDN endpoints

### Automated Backups

Recommended backup strategy:
```bash
# Backup CMS config
cp /path/to/storage/cms-config.json /backups/cms-config-$(date +%Y%m%d).json

# Backup assets
tar -czf /backups/assets-$(date +%Y%m%d).tar.gz /path/to/storage/assets/
```

Add this to a daily cron job for automated backups.

---

**Last Updated**: 2024-11-24
**CMS Version**: 1.0
