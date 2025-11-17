# Changelog Guide for WOWID3 Launcher

## Overview

The launcher displays changelog information fetched from the release server at `https://wowid-launcher.frostdev.io/api/manifest/latest`. The changelog is stored as a **string** field in the manifest.json file using **markdown format**.

## Changelog Format

### Supported Markdown Syntax

- `# Header` - Main section header (large, bold, gold color)
- `## Subheader` - Subsection header (medium, semibold, light green)
- `- Item` - Bullet point (displays with bullet)
- Plain text - Regular paragraph

### Example Structure

```markdown
# Version X.Y.Z - Release Name

## New Features
- Feature description 1
- Feature description 2

## Improvements
- Improvement description 1
- Improvement description 2

## Bug Fixes
- Bug fix description 1
- Bug fix description 2

## Changes
- Change description 1
- Change description 2

## Technical
- Technical detail 1
- Technical detail 2

## Known Issues
- Known issue 1
- Known issue 2
```

## How Users See Changelog

### Tooltip Preview (Hover)
- Shows **first 7 lines** of changelog
- Appears when hovering over version badge
- Includes "Click for full changelog" hint

### Full Modal (Click)
- Shows **complete changelog** with formatting
- Opens when clicking version badge
- Uses ChangelogViewer component

## Creating a Release with Changelog

### Option 1: Using Admin API

```bash
# 1. Login
curl -X POST https://wowid-launcher.frostdev.io/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-admin-password"}'

# 2. Upload files (get upload_id from response)
curl -X POST https://wowid-launcher.frostdev.io/api/admin/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@modpack.zip"

# 3. Create release with changelog
curl -X POST https://wowid-launcher.frostdev.io/api/admin/releases \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.2.3",
    "minecraft_version": "1.20.1",
    "fabric_loader": "0.18.0",
    "changelog": "# Version 1.2.3\n\n## New Features\n- Feature 1\n- Feature 2",
    "upload_id": "upload-id-from-step-2"
  }'
```

### Option 2: Using Admin Web UI

If the web interface is deployed at `https://wowid-launcher.frostdev.io/admin`:

1. Login with admin password
2. Navigate to "Create Release"
3. Fill in version details
4. Paste changelog in markdown format
5. Upload modpack files
6. Submit release

### Option 3: Manual File Edit

For testing or emergency updates:

```bash
# Edit the manifest directly on server
nano /storage/latest.json

# Or edit specific version
nano /storage/releases/1.2.3/manifest.json
```

## Changelog Best Practices

### Do's ✅

- **Use clear section headers**: Group changes by type (Features, Fixes, Changes)
- **Be specific**: "Fixed player model positioning" not "Fixed bug"
- **Keep it concise**: Each bullet point should be one line
- **Use present tense**: "Add feature" not "Added feature"
- **Include version number**: Always start with `# Version X.Y.Z`
- **Escape special characters**: Use `\n` for newlines in JSON

### Don'ts ❌

- **Don't use HTML**: Stick to markdown only
- **Don't make it too long**: First 7 lines show in preview
- **Don't use complex markdown**: Tables, images, etc. won't render
- **Don't forget newlines**: `\n\n` for paragraph breaks
- **Don't use array format**: Server expects string, not array

## Testing Changelog

### Local Testing

1. Update manifest.json with test changelog
2. Start launcher in dev mode: `npm run tauri:dev:wayland`
3. Hover over version badge to see preview
4. Click version badge to see full modal

### Verify Server Response

```bash
# Check if changelog is present
curl https://wowid-launcher.frostdev.io/api/manifest/latest | jq '.changelog'

# Verify formatting (should be a string with \n)
curl https://wowid-launcher.frostdev.io/api/manifest/latest | jq -r '.changelog'
```

## Example Workflow

```bash
# 1. Create changelog in a file
cat > changelog.txt << 'EOF'
# Version 1.2.3 - Winter Update

## New Features
- Added Christmas theme
- Added background music

## Bug Fixes
- Fixed player positioning
EOF

# 2. Convert to JSON-safe string (with \n escapes)
CHANGELOG=$(cat changelog.txt | jq -R -s '.')

# 3. Create release
curl -X POST https://wowid-launcher.frostdev.io/api/admin/releases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": \"1.2.3\",
    \"minecraft_version\": \"1.20.1\",
    \"fabric_loader\": \"0.18.0\",
    \"changelog\": $CHANGELOG,
    \"upload_id\": \"$UPLOAD_ID\"
  }"
```

## Troubleshooting

### Changelog Not Showing

1. Check server response: `curl .../api/manifest/latest | jq '.changelog'`
2. Verify it's a string, not an array
3. Check launcher console for errors
4. Verify `latestManifest` is populated in React DevTools

### Formatting Issues

1. Ensure using `\n` for newlines in JSON
2. Verify markdown syntax is correct
3. Test with simple changelog first
4. Check browser console for parsing errors

### Modal Not Opening

1. Verify `showChangelogModal` state updates
2. Check if changelog field exists and is non-empty
3. Verify ChangelogViewer component is rendered
4. Check for JavaScript errors in console

## Related Files

- **Launcher**: `/mnt/Dongus/wow-is-dead-3/wowid3-launcher/src/App.tsx`
- **Modal**: `/mnt/Dongus/wow-is-dead-3/wowid3-launcher/src/components/ChangelogViewer.tsx`
- **Server**: `/mnt/Dongus/wow-is-dead-3/wowid3-server/server/src/api/public.rs`
- **Types**: `/mnt/Dongus/wow-is-dead-3/wowid3-launcher/src/stores/modpackStore.ts`

## Support

For issues or questions, check:
- Server logs: `journalctl -u wowid3-server -f`
- Launcher logs: Browser DevTools console
- Release server: https://wowid-launcher.frostdev.io
