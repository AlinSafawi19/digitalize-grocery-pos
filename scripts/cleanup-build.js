/**
 * Cleanup Build Script
 * Kills running Electron processes and removes build artifacts
 * 
 * Usage:
 *   node scripts/cleanup-build.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up build artifacts...\n');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function killProcessesOnWindows() {
  try {
    // Kill Electron processes
    execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if process doesn't exist
  }
  
  try {
    // Kill the packaged app
    execSync('taskkill /F /IM DigitalizePOS.exe 2>nul', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if process doesn't exist
  }

  // Also try to find and kill any processes that might have files open in the release directory
  try {
    const releaseDir = path.join(__dirname, '..', 'release');
    if (fs.existsSync(releaseDir)) {
      // Use PowerShell to find processes with open handles to the release directory
      const psCommand = `Get-Process | Where-Object {$_.Path -like '*${releaseDir.replace(/\\/g, '\\\\')}*'} | Stop-Process -Force -ErrorAction SilentlyContinue`;
      execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore PowerShell errors
  }
}

async function removeDirectoryWindows(dirPath) {
  // Strategy 1: Try using Windows rmdir command (more aggressive)
  try {
    execSync(`rmdir /s /q "${dirPath}" 2>nul`, { stdio: 'ignore' });
    if (!fs.existsSync(dirPath)) {
      return true;
    }
  } catch (e) {
    // Continue to next strategy
  }

  // Strategy 2: Rename the directory first, then delete (helps with locked files)
  const tempDir = dirPath + '_delete_' + Date.now();
  try {
    fs.renameSync(dirPath, tempDir);
    // Wait a bit for file handles to release
    await sleep(1000);
    // Now try to delete the renamed directory
    try {
      execSync(`rmdir /s /q "${tempDir}" 2>nul`, { stdio: 'ignore' });
      if (!fs.existsSync(tempDir)) {
        return true;
      }
    } catch (e) {
      // Try Node.js method on renamed directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
        return true;
      } catch (e2) {
        // Still locked, but renamed - this is better than failing completely
        console.log(`   ⚠️  Directory renamed to ${path.basename(tempDir)} (will be cleaned on next build)`);
        return false; // Not fully deleted, but renamed
      }
    }
  } catch (renameError) {
    // Can't even rename, try direct deletion with retries
    let retries = 5;
    while (retries > 0) {
      try {
        await sleep(1000);
        fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        if (!fs.existsSync(dirPath)) {
          return true;
        }
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw err;
        }
      }
    }
  }

  return false;
}

async function main() {
  try {
    // Step 1: Kill any running Electron processes
    console.log('🔍 Checking for running Electron processes...');
    if (process.platform === 'win32') {
      killProcessesOnWindows();
      console.log('   ✅ Electron processes terminated (if any were running)');
      // Wait a moment for processes to fully terminate
      await sleep(1500);
    } else {
      try {
        execSync('pkill -f electron || true', { stdio: 'ignore' });
        console.log('   ✅ Electron processes terminated (if any were running)');
        await sleep(1000);
      } catch (error) {
        console.log('   ℹ️  No Electron processes found running');
      }
    }

    // Step 2: Remove release directory
    const releaseDir = path.join(__dirname, '..', 'release');
    if (fs.existsSync(releaseDir)) {
      console.log('\n🗑️  Removing release directory...');
      
      if (process.platform === 'win32') {
        const success = await removeDirectoryWindows(releaseDir);
        if (success) {
          console.log('   ✅ Release directory removed');
        } else {
          console.log('   ⚠️  Release directory partially cleaned (some files may be locked)');
          console.log('   The build will continue, but you may need to manually close any running instances.');
          // Don't throw error - allow build to continue
        }
      } else {
        // Unix-like systems
        try {
          fs.rmSync(releaseDir, { recursive: true, force: true });
          console.log('   ✅ Release directory removed');
        } catch (error) {
          console.log('   ⚠️  Warning: Could not fully remove release directory');
          console.log('   This might be because files are still locked.');
          console.log('   Please close any running instances of the app and try again.');
          // Don't throw - allow build to continue
        }
      }
    } else {
      console.log('\n   ℹ️  Release directory does not exist (nothing to clean)');
    }

    console.log('\n✅ Cleanup complete!\n');
  } catch (error) {
    console.error('\n⚠️  Cleanup encountered issues:', error.message);
    console.log('   Continuing with build anyway...\n');
    // Don't exit - allow build to continue
    // The build process itself might handle locked files better
  }
}

// Run main and handle any unhandled promise rejections
main().catch((error) => {
  console.error('Unhandled error in cleanup:', error);
  process.exit(1);
});

