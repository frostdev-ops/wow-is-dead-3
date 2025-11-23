# Launcher Distribution Manual Testing Guide

This document outlines the manual tests that should be performed to verify the launcher distribution and update system implementation.

## Test Environment Setup

### Prerequisites

1. Server running on localhost:8080 or production server
2. Admin panel accessible (localhost:5173 for dev, or production URL)
3. Test files for upload:
   - Windows installer (.exe from bundle/nsis/)
   - Windows executable (.exe from target/release/)
   - Linux AppImage (.AppImage from bundle/appimage/)
4. Admin credentials configured in server environment

### Starting Test Environment

```bash
# Start server backend
cd wowid3-server/server && cargo run

# In separate terminal, start admin panel
cd wowid3-server/web && npm run dev
```

## Test Suite

### 1. Platform Detection Tests

**Purpose**: Verify User-Agent based platform detection works correctly

**Test 1.1: Windows Detection**
```bash
curl -v -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  http://localhost:8080/api/launcher/latest/installer
```

**Expected Results**:
- If no Windows installer exists: 404 Not Found with message "No installer available for windows"
- If Windows installer exists: 200 OK with file download
- Response headers include Content-Disposition with filename

**Test 1.2: Linux Detection**
```bash
curl -v -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64)" \
  http://localhost:8080/api/launcher/latest/installer
```

**Expected Results**:
- If no Linux installer exists: 404 Not Found with message "No installer available for linux"
- If Linux installer exists: 200 OK with file download
- Response headers include Content-Disposition with filename

**Test 1.3: macOS Detection**
```bash
curl -v -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  http://localhost:8080/api/launcher/latest/installer
```

**Expected Results**:
- 404 Not Found with message "No installer available for macos" (macOS not yet supported)

**Test 1.4: Unknown Platform**
```bash
curl -v -H "User-Agent: Unknown/1.0" \
  http://localhost:8080/api/launcher/latest/installer
```

**Expected Results**:
- 400 Bad Request
- Error message: "Could not detect platform from User-Agent. Use /api/launcher/latest/installer/{platform}"

**Test 1.5: Missing User-Agent**
```bash
curl -v http://localhost:8080/api/launcher/latest/installer
```

**Expected Results**:
- 400 Bad Request
- Error message indicating platform detection failed

### 2. Explicit Platform Selection Tests

**Purpose**: Verify explicit platform endpoints work correctly

**Test 2.1: Explicit Windows Installer**
```bash
curl -v http://localhost:8080/api/launcher/latest/installer/windows
```

**Expected Results**:
- If no Windows installer exists: 404 Not Found
- If Windows installer exists: 200 OK with file download

**Test 2.2: Explicit Linux Installer**
```bash
curl -v http://localhost:8080/api/launcher/latest/installer/linux
```

**Expected Results**:
- If no Linux installer exists: 404 Not Found
- If Linux installer exists: 200 OK with file download

**Test 2.3: Invalid Platform**
```bash
curl -v http://localhost:8080/api/launcher/latest/installer/freebsd
```

**Expected Results**:
- 400 Bad Request
- Error message: "Invalid platform: freebsd"

### 3. Backward Compatibility Tests

**Purpose**: Verify existing launchers continue to work

**Test 3.1: Old Manifest Endpoint Redirect**
```bash
curl -I http://localhost:8080/api/launcher/latest
```

**Expected Results**:
- 308 Permanent Redirect
- Location header: /api/launcher/latest/executable

**Test 3.2: Follow Redirect**
```bash
curl -L -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  http://localhost:8080/api/launcher/latest
```

**Expected Results**:
- Follows redirect to executable endpoint
- If Windows executable exists: 200 OK with file download
- If no Windows executable exists: 404 Not Found

### 4. Executable vs Installer Tests

**Purpose**: Verify file_type filtering works correctly

**Test 4.1: Windows Installer vs Executable**
```bash
# Request installer
curl -I http://localhost:8080/api/launcher/latest/installer/windows

# Request executable
curl -I http://localhost:8080/api/launcher/latest/executable/windows
```

**Expected Results**:
- Installer endpoint returns NSIS installer file (WOWID3Launcher-Setup-{version}.exe)
- Executable endpoint returns standalone executable (WOWID3Launcher.exe)
- Files have different sizes and SHA256 hashes

**Test 4.2: Linux AppImage (both installer and executable)**
```bash
# Request installer
curl -I http://localhost:8080/api/launcher/latest/installer/linux

# Request executable
curl -I http://localhost:8080/api/launcher/latest/executable/linux
```

**Expected Results**:
- Both endpoints return the same AppImage file
- Same filename, size, and SHA256 hash

### 5. Admin Panel Tests

**Purpose**: Verify admin UI for launcher release management

**Test 5.1: Admin Authentication**
1. Navigate to admin panel login page
2. Enter admin password
3. Click login

**Expected Results**:
- Successful login redirects to dashboard
- JWT token stored in browser
- Subsequent API requests include Authorization header

**Test 5.2: View Launcher Releases List**
1. Navigate to /admin/launcher
2. Verify list displays

**Expected Results**:
- Page loads without errors
- If no releases exist: "No launcher releases yet" message
- If releases exist: All releases displayed with:
  - Version number
  - Mandatory flag (if applicable)
  - Release date
  - List of files with platform and file_type
  - File sizes
  - Changelog content

**Test 5.3: Create New Release**
1. Click "Create New Release" button
2. Fill in form:
   - Version: 1.2.0-test
   - Changelog: "- Test release\n- Verify upload functionality"
   - Mandatory: checked
3. Upload Windows installer file
4. Upload Windows executable file
5. Upload Linux AppImage file
6. Click "Create Release"

**Expected Results**:
- Form validation passes
- Upload progress shown (if large files)
- Success message or redirect on completion
- New release appears in releases list
- All files uploaded to storage directory
- Manifest JSON created with correct structure
- SHA256 hashes calculated for all files
- URLs point to correct file paths

**Test 5.4: Verify Uploaded Files**
```bash
# Check storage directory
ls -lh wowid3-server/storage/launcher/1.2.0-test/

# Verify manifest
cat wowid3-server/storage/launcher/1.2.0-test/manifest.json
```

**Expected Results**:
- Directory contains all uploaded files
- Manifest JSON is valid
- Manifest includes:
  - version: "1.2.0-test"
  - mandatory: true
  - changelog content
  - files array with correct platforms and file_types
  - SHA256 hashes for all files
  - Correct URLs

**Test 5.5: Download Files via API**
```bash
# Download Windows installer
curl -O http://localhost:8080/api/launcher/latest/installer/windows

# Download Windows executable
curl -O http://localhost:8080/api/launcher/latest/executable/windows

# Download Linux AppImage
curl -O http://localhost:8080/api/launcher/latest/installer/linux
```

**Expected Results**:
- All files download successfully
- File sizes match manifest
- SHA256 hashes match manifest

**Test 5.6: Verify SHA256 Hashes**
```bash
# Calculate hashes of downloaded files
sha256sum WOWID3Launcher-Setup-1.2.0-test.exe
sha256sum WOWID3Launcher.exe
sha256sum WOWID3Launcher-1.2.0-test.AppImage

# Compare to manifest
cat wowid3-server/storage/launcher/1.2.0-test/manifest.json | grep sha256
```

**Expected Results**:
- All calculated hashes match manifest values

### 6. Multi-Version Tests

**Purpose**: Verify version management with multiple releases

**Test 6.1: Create Second Release**
1. Create another release with version 1.3.0-test
2. Upload same files

**Expected Results**:
- Second release created successfully
- Both versions listed in admin panel
- Latest version index updated

**Test 6.2: Verify Latest Version Endpoint**
```bash
curl http://localhost:8080/api/launcher/manifest/latest
```

**Expected Results**:
- Returns manifest for version 1.3.0-test (latest)

**Test 6.3: Verify Version-Specific Endpoints**
```bash
curl http://localhost:8080/api/launcher/manifest/1.2.0-test
curl http://localhost:8080/api/launcher/manifest/1.3.0-test
```

**Expected Results**:
- Each endpoint returns correct version manifest

### 7. Error Handling Tests

**Purpose**: Verify graceful error handling

**Test 7.1: Upload Without Files**
1. Fill in version and changelog
2. Don't upload any files
3. Submit

**Expected Results**:
- Error message: "At least one file is required"
- Form not submitted

**Test 7.2: Upload Without Version**
1. Upload files
2. Leave version field empty
3. Submit

**Expected Results**:
- HTML5 validation error: "Version is required"
- Form not submitted

**Test 7.3: Upload Without Changelog**
1. Fill in version
2. Upload files
3. Leave changelog empty
4. Submit

**Expected Results**:
- HTML5 validation error: "Changelog is required"
- Form not submitted

**Test 7.4: Duplicate Version**
1. Create release with version 1.2.0-test
2. Try to create another release with same version

**Expected Results**:
- Error message or overwrite warning (implementation dependent)

**Test 7.5: Invalid File Types**
1. Try to upload .txt file as Windows installer
2. Submit

**Expected Results**:
- File input validation prevents non-.exe files
- Or server-side validation rejects invalid files

### 8. Integration Tests with Launcher Client

**Purpose**: Verify launcher client can check for updates

**Test 8.1: Launcher Update Check**
1. Build and run launcher
2. Trigger update check (manual or automatic)

**Expected Results**:
- Launcher fetches manifest from /api/launcher/latest/executable
- If update available: Shows update notification
- If no update: No notification

**Test 8.2: Launcher Update Download**
1. Create new launcher release
2. Run launcher with older version
3. Accept update

**Expected Results**:
- Launcher downloads executable file
- SHA256 verification passes
- Launcher prompts to restart
- After restart, new version running

**Test 8.3: Mandatory Update Enforcement**
1. Create mandatory update
2. Run launcher with older version

**Expected Results**:
- Launcher enforces mandatory update
- User cannot skip update
- Launcher downloads and applies update

## Test Results Template

### Test Run Information

- **Date**: YYYY-MM-DD
- **Tester**: [Name]
- **Environment**: Development / Staging / Production
- **Server Version**: [Git commit hash]
- **Launcher Version**: [Version number]

### Test Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Windows Detection | PASS/FAIL | |
| 1.2 | Linux Detection | PASS/FAIL | |
| 1.3 | macOS Detection | PASS/FAIL | |
| 1.4 | Unknown Platform | PASS/FAIL | |
| 1.5 | Missing User-Agent | PASS/FAIL | |
| 2.1 | Explicit Windows Installer | PASS/FAIL | |
| 2.2 | Explicit Linux Installer | PASS/FAIL | |
| 2.3 | Invalid Platform | PASS/FAIL | |
| 3.1 | Old Endpoint Redirect | PASS/FAIL | |
| 3.2 | Follow Redirect | PASS/FAIL | |
| 4.1 | Windows Installer vs Executable | PASS/FAIL | |
| 4.2 | Linux AppImage | PASS/FAIL | |
| 5.1 | Admin Authentication | PASS/FAIL | |
| 5.2 | View Releases List | PASS/FAIL | |
| 5.3 | Create New Release | PASS/FAIL | |
| 5.4 | Verify Uploaded Files | PASS/FAIL | |
| 5.5 | Download Files via API | PASS/FAIL | |
| 5.6 | Verify SHA256 Hashes | PASS/FAIL | |
| 6.1 | Create Second Release | PASS/FAIL | |
| 6.2 | Verify Latest Version | PASS/FAIL | |
| 6.3 | Version-Specific Endpoints | PASS/FAIL | |
| 7.1 | Upload Without Files | PASS/FAIL | |
| 7.2 | Upload Without Version | PASS/FAIL | |
| 7.3 | Upload Without Changelog | PASS/FAIL | |
| 7.4 | Duplicate Version | PASS/FAIL | |
| 7.5 | Invalid File Types | PASS/FAIL | |
| 8.1 | Launcher Update Check | PASS/FAIL | |
| 8.2 | Launcher Update Download | PASS/FAIL | |
| 8.3 | Mandatory Update Enforcement | PASS/FAIL | |

### Summary

- **Total Tests**: 28
- **Passed**: [X]
- **Failed**: [Y]
- **Skipped**: [Z]

### Issues Found

1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce
   - Expected vs actual behavior

### Recommendations

[Any recommendations for improvements or additional testing]

## Automated Testing Opportunities

The following tests could be automated in the future:

1. Platform detection unit tests (already implemented in Rust)
2. API endpoint integration tests using HTTP client
3. File upload validation tests
4. SHA256 hash verification tests
5. Redirect behavior tests
6. Error response format tests

## Notes

- All file uploads use multipart/form-data encoding
- SHA256 hashes are calculated server-side for security
- Platform detection uses standard User-Agent parsing
- Backward compatibility maintained via 308 redirect
- Admin authentication uses JWT tokens
- File storage uses versioned directories
