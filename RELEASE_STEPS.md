# Step-by-Step Release Guide

This guide walks you through releasing a new version of DigitalizePOS so users can update to it.

## Prerequisites

- ✅ All code changes are committed
- ✅ You have access to upload files to `https://downloads.digitalizepos.com`
- ✅ You're in the `digitalize-grocery-pos` directory

---

## Step 1: Choose Your Version Type

Decide what type of release this is:

- **Patch** (1.0.0 → 1.0.1): Bug fixes, small improvements
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes, major new features

**Current version:** Check `package.json` or run:
```bash
node -p "require('./package.json').version"
```

---

## Step 2: Run the Automated Release

This single command does everything:
- Bumps version in `package.json`
- Builds the application
- Creates the installer
- Generates `latest.yml` with correct metadata

```bash
# For bug fixes
npm run release:patch

# OR for new features
npm run release:minor

# OR for major changes
npm run release:major
```

**What happens:**
1. Version is bumped (e.g., 1.0.0 → 1.0.1)
2. Application is built
3. Installer is created in `release/` folder
4. `latest.yml` is generated with SHA512 hash and file size

**Expected output:**
```
🚀 Starting Automated Release Process
Version type: patch

📦 Step 1: Bumping version...
✅ Version bumped: 1.0.0 → 1.0.1

🔨 Step 2: Building application...
   This may take a few minutes...

📝 Step 3: Generating latest.yml...
✅ latest.yml generated

✅ Step 4: Verifying release files...
   ✅ grocery-pos-1.0.1.exe (123.45 MB)
   ✅ latest.yml

🎉 Release Process Complete!
```

**Time:** This takes 5-10 minutes depending on your machine.

---

## Step 3: Verify Local Files

Check that both files exist in the `release/` folder:

```bash
# List files
dir release

# You should see:
# - grocery-pos-X.X.X.exe
# - latest.yml
```

Verify the installer file size is reasonable (~100-200 MB).

---

## Step 4: Upload Files to Update Server

Upload **both files** to `https://downloads.digitalizepos.com/`:

### Files to Upload:
1. `release/grocery-pos-X.X.X.exe` (the installer)
2. `release/latest.yml` (the metadata file)

### Upload Methods:

#### Option A: Manual Upload (via FTP/SFTP/Web Interface)
1. Connect to your server (FTP client, cPanel, etc.)
2. Navigate to the root directory where files are served
3. Upload both files:
   - `grocery-pos-X.X.X.exe`
   - `latest.yml` (overwrite the existing one)

#### Option B: Using the Upload Script
```bash
# This script will guide you through manual upload
node scripts/upload-update-files.js
```

**Important:**
- ✅ Both files must be in the same directory
- ✅ File names must match exactly (case-sensitive)
- ✅ `latest.yml` must reference the correct installer filename

---

## Step 5: Verify Update Server

After uploading, verify the files are accessible:

```bash
npm run update:verify
```

**Expected output:**
```
🔍 Verifying Update Server Configuration...

Server: https://downloads.digitalizepos.com

1. Checking latest.yml...
   ✅ latest.yml is accessible
   ✅ Contains version 1.0.1

2. Checking installer file...
   ✅ Installer file is accessible
   Status: 200
   Size: 123.45 MB

📋 Summary:
   If both files are accessible, your update server is configured correctly!
```

**If verification fails:**
- Check file permissions on server
- Verify file names match exactly
- Check server logs for errors
- Ensure files are in the correct directory

---

## Step 6: Verify File Match (Optional but Recommended)

Ensure the uploaded file matches your local file:

```bash
node scripts/verify-file-match.js
```

This compares:
- SHA512 hash
- File size
- Against `latest.yml` values

---

## Step 7: Update Marketing Website

Update the marketing website to show the new release:

### 7.1: Generate Version File

```bash
cd ../digitalize-marketing-website
npm run prebuild
```

This generates `public/version.json` from the grocery-pos `package.json`.

### 7.2: Add Release Notes (Optional)

Edit `src/pages/ReleasesPage.tsx` to add the new release to the `DEFAULT_RELEASES` array:

```typescript
const DEFAULT_RELEASES: Release[] = [
  {
    version: '1.0.1',  // New version
    date: '2024-12-24',  // Today's date
    type: 'patch',  // or 'minor' or 'major'
    releaseNotes: `# Version 1.0.1

## Bug Fixes
- Fixed notification access issue
- Fixed username update bug
- Improved stock adjustment workflow

## Improvements
- Enhanced update notification system
- Better error handling`,
  },
  // ... keep old releases below
]
```

### 7.3: Build and Deploy Marketing Website

```bash
npm run build
# Then deploy the build output
```

---

## Step 8: Test the Update (Recommended)

### Test on a Clean Machine:
1. Install the **old version** (e.g., 1.0.0) on a test machine
2. Open the app and wait 30 seconds (auto-update check)
3. You should see an update notification
4. Click "Download" and verify the update downloads
5. Install the update and verify it works

### Test Update Flow:
- ✅ Update notification appears
- ✅ Download progress shows correctly
- ✅ Update installs successfully
- ✅ App restarts with new version
- ✅ All features work correctly

---

## Step 9: Monitor and Support

After release:

1. **Monitor for issues:**
   - Check server logs for download errors
   - Monitor user feedback
   - Watch for update-related errors

2. **Support users:**
   - Users on old versions will see update notifications
   - They can download and install automatically
   - Or they can download manually from the website

3. **Rollback plan (if needed):**
   - Keep old installer files on server
   - Can revert `latest.yml` to point to previous version
   - Users can reinstall old version if needed

---

## Quick Reference Commands

```bash
# Full automated release
npm run release:patch    # Bug fixes
npm run release:minor    # New features
npm run release:major    # Major changes

# Verify update server
npm run update:verify

# Verify file match
node scripts/verify-file-match.js

# Check current version
node -p "require('./package.json').version"
```

---

## Troubleshooting

### Issue: Update notification doesn't appear
- ✅ Check `latest.yml` version is higher than current app version
- ✅ Verify `latest.yml` is accessible at the URL
- ✅ Check app logs for update check errors
- ✅ Ensure app has internet connection

### Issue: Download fails
- ✅ Verify installer file is accessible
- ✅ Check file permissions on server
- ✅ Verify SHA512 hash in `latest.yml` matches installer
- ✅ Check server logs for errors

### Issue: Installer doesn't match latest.yml
- ✅ Regenerate `latest.yml`: `npm run update:generate-yml`
- ✅ Re-upload both files
- ✅ Run `node scripts/verify-file-match.js`

### Issue: Users can't update
- ✅ Verify both files are on server
- ✅ Check file names match exactly
- ✅ Ensure `latest.yml` has correct version number
- ✅ Verify update server URL in `package.json` is correct

---

## Summary Checklist

- [ ] Code changes are complete and tested
- [ ] Version bumped (patch/minor/major)
- [ ] Application built successfully
- [ ] Installer created in `release/` folder
- [ ] `latest.yml` generated with correct metadata
- [ ] Both files uploaded to update server
- [ ] Update server verified (`npm run update:verify`)
- [ ] File match verified (optional)
- [ ] Marketing website updated
- [ ] Update tested on clean machine
- [ ] Monitoring in place

---

**You're done!** Users with the app installed will automatically see update notifications and can update to the new version.

