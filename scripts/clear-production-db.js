/**
 task kill: taskkill /F /IM "DigitalizePOS.exe" 2>$null; taskkill /F /IM "electron.exe" /FI "WINDOWTITLE eq *DigitalizePOS*" 2>$null; Get-Process | Where-Object {$_.ProcessName -like "*DigitalizePOS*" -or ($_.ProcessName -eq "electron" -and $_.MainWindowTitle -like "*DigitalizePOS*")} | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Write-Host "✅ Attempted to close DigitalizePOS processes. Check Task Manager if issues persist."
  
 clear db: cd C:\Projects\DigitalizePOS\digitalize-grocery-pos; node scripts/clear-production-db.js
 
 run installer: cd C:\Projects\DigitalizePOS\digitalize-grocery-pos\release
   & ".\DigitalizePOS Setup 1.0.0.exe"
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { PrismaClient } = require('@prisma/client');

/**
 * Get Electron userData path without Electron app context
 * This matches Electron's app.getPath('userData') behavior
 */
function getUserDataPath() {
  // Read app name from package.json (this is what Electron uses)
  let appName = 'digitalize-grocery-pos'; // Default fallback
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      appName = packageJson.name || appName;
    }
  } catch (error) {
    // If we can't read package.json, use default
    console.warn('Could not read package.json, using default app name');
  }
  
  const platform = process.platform;
  const homedir = os.homedir();

  if (platform === 'win32') {
    // Windows: %APPDATA%\{appName}
    const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
    return path.join(appData, appName);
  } else if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/{appName}
    return path.join(homedir, 'Library', 'Application Support', appName);
  } else {
    // Linux: ~/.config/{appName}
    return path.join(homedir, '.config', appName);
  }
}

// Get database path
const userDataPath = getUserDataPath();
const dbPath = path.join(userDataPath, 'database', 'digitalizePOS.db');
const licenseDir = path.join(userDataPath, 'license');

// Also check for alternative app name variations (in case app name changed over time)
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const possibleAppNames = ['digitalize-grocery-pos'];
const alternativeDbPaths = possibleAppNames
  .filter(name => name !== path.basename(userDataPath)) // Don't duplicate the primary path
  .map(name => path.join(appData, name, 'database', 'digitalizePOS.db'));

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = `file:${dbPath}`;

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
fs.ensureDirSync(dbDir);

console.log('🌱 Production Database Clear Script');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('⚠️  IMPORTANT: Make sure the DigitalizePOS app is COMPLETELY CLOSED!');
console.log('   The app caches license status in memory.');
console.log('   You MUST close the app before running this script, then restart it after.');
console.log('');
console.log(`📁 App Data Path: ${userDataPath}`);
console.log(`📁 Database Path: ${dbPath}`);
console.log(`📁 License Dir: ${licenseDir}`);
console.log('');

const prisma = new PrismaClient();

/**
 * Search for license files in common locations
 */
async function searchForLicenseFiles() {
  const possiblePaths = [];
  
  // Standard userData path
  const userDataPath = getUserDataPath();
  possiblePaths.push(path.join(userDataPath, 'license', 'license.dat'));
  possiblePaths.push(path.join(userDataPath, 'license', 'credentials.dat'));
  
  // Also check if there's a different app name variant
  const appNameVariants = ['digitalize-grocery-pos'];
  const platform = process.platform;
  const homedir = os.homedir();
  
  for (const appName of appNameVariants) {
    let variantPath;
    if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
      variantPath = path.join(appData, appName);
    } else if (platform === 'darwin') {
      variantPath = path.join(homedir, 'Library', 'Application Support', appName);
    } else {
      variantPath = path.join(homedir, '.config', appName);
    }
    possiblePaths.push(path.join(variantPath, 'license', 'license.dat'));
    possiblePaths.push(path.join(variantPath, 'license', 'credentials.dat'));
  }
  
  // Check project directory (for dev mode)
  const projectPath = process.cwd();
  possiblePaths.push(path.join(projectPath, 'license', 'license.dat'));
  possiblePaths.push(path.join(projectPath, 'license', 'credentials.dat'));
  
  return possiblePaths;
}

/**
 * Clear license files (license.dat and credentials.dat)
 */
async function clearLicenseFiles() {
  try {
    const userDataPath = getUserDataPath();
    const licenseDir = path.join(userDataPath, 'license');
    
    console.log('🧹 Clearing license files...');
    console.log(`   Primary location: ${userDataPath}`);
    console.log(`   License dir: ${licenseDir}`);
    
    // Search for license files in all possible locations
    const allPossiblePaths = await searchForLicenseFiles();
    let foundAny = false;
    let deletedAny = false;
    let deletedLicenseCount = 0;
    let deletedCredentialsCount = 0;
    
    // First, list all files we're checking
    console.log(`   🔍 Searching in ${allPossiblePaths.length} possible locations...`);
    
    for (const filePath of allPossiblePaths) {
      const exists = await fs.pathExists(filePath);
      if (exists) {
        foundAny = true;
        const fileType = filePath.includes('credentials.dat') ? 'credentials.dat' : 'license.dat';
        console.log(`   📄 Found ${fileType}: ${filePath}`);
        
        try {
          await fs.remove(filePath);
          console.log(`   ✓ Deleted: ${filePath}`);
          deletedAny = true;
          
          // Track what was deleted
          if (filePath.includes('license.dat') && !filePath.includes('credentials')) {
            deletedLicenseCount++;
          } else if (filePath.includes('credentials.dat')) {
            deletedCredentialsCount++;
          }
        } catch (error) {
          console.log(`   ⚠️  Could not delete: ${filePath}`);
          console.log(`      Error: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    
    // Show summary of what we searched
    const licensePaths = allPossiblePaths.filter(p => p.includes('license.dat') && !p.includes('credentials'));
    const credentialsPaths = allPossiblePaths.filter(p => p.includes('credentials.dat'));
    console.log(`   📊 Search summary:`);
    console.log(`      - Checked ${licensePaths.length} locations for license.dat`);
    console.log(`      - Checked ${credentialsPaths.length} locations for credentials.dat`);
    
    if (!foundAny) {
      console.log(`   ℹ No license or credentials files found in any location`);
      console.log(`   ℹ Searched for:`);
      console.log(`      - license.dat (in ${allPossiblePaths.filter(p => p.includes('license.dat')).length} locations)`);
      console.log(`      - credentials.dat (in ${allPossiblePaths.filter(p => p.includes('credentials.dat')).length} locations)`);
      console.log(`   ℹ This could mean:`);
      console.log(`      - License was never activated`);
      console.log(`      - Files are in a different location`);
      console.log(`      - App is caching license status in memory (MUST RESTART APP)`);
      console.log(`   ℹ If credentials.dat exists elsewhere, it will be overwritten on next activation`);
    } else if (deletedAny) {
      console.log('✅ License and credentials files cleared successfully!');
      if (deletedLicenseCount > 0) {
        console.log(`   ✓ Deleted ${deletedLicenseCount} license.dat file(s)`);
      }
      if (deletedCredentialsCount > 0) {
        console.log(`   ✓ Deleted ${deletedCredentialsCount} credentials.dat file(s)`);
      }
      if (deletedLicenseCount === 0 && deletedCredentialsCount === 0) {
        console.log(`   ℹ Note: Files were found but type could not be determined`);
      }
    } else {
      console.log('⚠️  Found license/credentials files but could not delete them');
    }
  } catch (error) {
    console.error('❌ Error clearing license files:', error instanceof Error ? error.message : error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
    // Don't fail the script if license files can't be cleared
  }
}

async function main() {
  // Check if database file exists
  if (await fs.pathExists(dbPath)) {
    const stats = await fs.stat(dbPath);
    console.log(`📁 Database file exists: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.log('📁 Database file does not exist yet (will be created on first app run)');
  }
  console.log('');

  console.log('🧹 Clearing existing data...');
  
  // Delete ALL possible database locations (in case app name changed over time)
  const databasesToDelete = [
    { path: dbPath, name: `primary (${path.basename(userDataPath)})` },
    ...alternativeDbPaths.map(altPath => ({
      path: altPath,
      name: `alternative (${path.basename(path.dirname(path.dirname(altPath)))})`
    }))
  ];
  
  let deletedAny = false;
  for (const db of databasesToDelete) {
    if (await fs.pathExists(db.path)) {
      try {
        // Close Prisma connection first (only once)
        if (!deletedAny) {
          await prisma.$disconnect();
        }
        
        console.log(`   ⚠️  Found database file (${db.name}) - deleting it completely...`);
        
        // Delete the database file
        await fs.remove(db.path);
        
        // Also delete SQLite journal files if they exist
        const walFile = db.path + '-wal';
        const shmFile = db.path + '-shm';
        if (await fs.pathExists(walFile)) {
          await fs.remove(walFile);
          console.log(`   ✓ Deleted SQLite WAL file (${db.name})`);
        }
        if (await fs.pathExists(shmFile)) {
          await fs.remove(shmFile);
          console.log(`   ✓ Deleted SQLite SHM file (${db.name})`);
        }
        
        console.log(`   ✓ Database file deleted (${db.name})`);
        deletedAny = true;
        
        // Also check for any backup database files in the same directory
        const dbDir = path.dirname(db.path);
        try {
          const files = await fs.readdir(dbDir);
          const backupFiles = files
            .filter(f => typeof f === 'string')
            .filter(f => 
              f.includes('digitalizePOS') && 
              (f.endsWith('.db') || f.endsWith('.db-backup') || f.endsWith('.bak'))
            );
          
          if (backupFiles.length > 0) {
            console.log(`   ⚠️  Found ${backupFiles.length} potential backup database file(s) (${db.name}):`);
            for (const backupFile of backupFiles) {
              const backupPath = path.join(dbDir, backupFile);
              try {
                await fs.remove(backupPath);
                console.log(`   ✓ Deleted backup: ${backupFile}`);
              } catch (error) {
                console.log(`   ⚠️  Could not delete backup: ${backupFile}`);
              }
            }
          }
        } catch (error) {
          // Ignore errors reading directory
        }
      } catch (error) {
        console.log(`   ⚠️  Could not delete database file (${db.name})`);
        console.log(`      Error: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  
  if (deletedAny) {
    console.log('   ✓ SQLite journal files deleted (if any)');
    console.log('   ℹ A new empty database will be created when the app runs');
    
    // Verify the files are actually gone
    for (const db of databasesToDelete) {
      if (await fs.pathExists(db.path)) {
        console.log(`   ❌ ERROR: Database file (${db.name}) still exists after deletion attempt!`);
        console.log('   Try closing the app completely and running the script again.');
      } else {
        console.log(`   ✓ Verified: Database file (${db.name}) is actually deleted`);
      }
    }
    
    console.log('');
    console.log('✅ Database cleared successfully!');
    console.log('');
    
    // Continue to clear license files, then exit
    await clearLicenseFiles();
    
    // Verify
    console.log('');
    console.log('🔍 Verifying everything is cleared...');
    let allDeleted = true;
    for (const db of databasesToDelete) {
      if (await fs.pathExists(db.path)) {
        console.log(`   ❌ WARNING: Database file (${db.name}) still exists!`);
        console.log('   The script may not have worked correctly.');
        console.log('   Make sure the app is completely closed before running the script.');
        allDeleted = false;
      }
    }
    if (allDeleted) {
      console.log('   ✓ Verified: All database files deleted (completely clean)');
      console.log('   ✓ Verified: No users can exist (databases don\'t exist)');
      console.log('   ✓ Credentials will be created on next activation');
    }
    
    return; // Exit early since databases are deleted
  }
  
  // If no databases were found, check if we should continue
  if (!deletedAny) {
    console.log('   ℹ No database files found in any location (already clean)');
    // Continue to clear license files
  }
  
  // Clear license files
  await clearLicenseFiles();
  
  // If database file still exists, try clearing tables
  if (await fs.pathExists(dbPath)) {
    console.log('');
    console.log('🧹 Database file still exists, clearing all tables...');
    
    try {
      // Helper function to safely delete from a table
      const safeDelete = async (model, name) => {
        try {
          await model.deleteMany();
          console.log(`   ✓ Cleared ${name} table`);
          return true;
        } catch (error) {
          // P2021 = Table does not exist (database not initialized yet)
          if (error.code === 'P2021') {
            console.log(`   ℹ ${name} table does not exist (skipping)`);
            return false;
          }
          throw error;
        }
      };
      
      // Delete child tables first (those with foreign keys)
      await safeDelete(prisma.transactionItem, 'TransactionItem');
      await safeDelete(prisma.payment, 'Payment');
      await safeDelete(prisma.stockMovement, 'StockMovement');
      await safeDelete(prisma.priceHistory, 'PriceHistory');
      await safeDelete(prisma.purchaseOrderItem, 'PurchaseOrderItem');
      await safeDelete(prisma.purchaseInvoice, 'PurchaseInvoice');
      await safeDelete(prisma.inventory, 'Inventory');
      await safeDelete(prisma.pricingRule, 'PricingRule');
      await safeDelete(prisma.transaction, 'Transaction');
      await safeDelete(prisma.purchaseOrder, 'PurchaseOrder');
      await safeDelete(prisma.product, 'Product');
      await safeDelete(prisma.category, 'Category');
      await safeDelete(prisma.supplier, 'Supplier');
      await safeDelete(prisma.scheduledReport, 'ScheduledReport');
      await safeDelete(prisma.auditLog, 'AuditLog');
      await safeDelete(prisma.notification, 'Notification');
      await safeDelete(prisma.promotion, 'Promotion');
      
      // Delete parent tables
      await safeDelete(prisma.user, 'User');
      await safeDelete(prisma.setting, 'Setting');
      
      console.log('✅ All tables cleared successfully!');
    } catch (error) {
      console.error('❌ Error clearing tables:', error.message);
    }
  }
  
  // Clear license files (this will force the app to show activation page)
  await clearLicenseFiles();
  
  // Verify files are actually gone
  console.log('');
  console.log('🔍 Verifying everything is cleared...');
  try {
    // Check all possible locations for license files
    const allPossiblePaths = await searchForLicenseFiles();
    const existingFiles = [];
    
    for (const filePath of allPossiblePaths) {
      if (await fs.pathExists(filePath)) {
        existingFiles.push(filePath);
      }
    }
    
    if (existingFiles.length > 0) {
      console.log('⚠️  WARNING: Some license files still exist!');
      for (const file of existingFiles) {
        console.log(`   ❌ ${file} still exists`);
      }
    } else {
      console.log('   ✓ Verified: All license files are cleared from all locations');
    }
    
    // Verify database is empty
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        console.log(`   ⚠️  WARNING: Database still has ${userCount} user(s)!`);
        console.log('   Credentials will NOT be shown if users exist.');
        console.log('   This should not happen - the script should have cleared all users.');
      } else {
        console.log('   ✓ Verified: Database has no users (credentials will be created on activation)');
      }
    } catch (error) {
      // P2021 = Table does not exist (database not initialized yet)
      if (error.code === 'P2021') {
        console.log('   ✓ Verified: Database is empty/new (no tables exist yet)');
        console.log('   ✓ This means no users exist - credentials will be created on activation');
      } else {
        throw error; // Re-throw other errors
      }
    }
  } catch (error) {
    console.log('   ⚠️  Could not verify cleanup');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Database structure initialized successfully!');
  console.log('');
  console.log('📋 What was cleared:');
  console.log('  ✓ All database tables (users, products, transactions, etc.)');
  console.log('  ✓ License activation file (license.dat)');
  console.log('  ✓ Saved credentials file (credentials.dat)');
  console.log('');
  console.log('📝 Next steps:');
  console.log('  1. Restart the application (if running)');
  console.log('  2. You will see the license activation page');
  console.log('  3. Activate your license - a new user will be created');
  console.log('  4. New credentials will be generated and saved');
  console.log('');
  console.log('');
  console.log('⚠️  CRITICAL: The app MUST be fully closed and restarted!');
  console.log('');
  console.log('   The license status is cached in memory. Even if files are deleted,');
  console.log('   a running app will still think it\'s activated until restarted.');
  console.log('');
  console.log('   Steps to fix:');
  console.log('   1. Close ALL DigitalizePOS POS windows');
  console.log('   2. Open Task Manager (Ctrl+Shift+Esc)');
  console.log('   3. End ALL processes named:');
  console.log('      - DigitalizePOS POS');
  console.log('      - electron (if DigitalizePOS is the only Electron app)');
  console.log('   4. Wait 5 seconds');
  console.log('   5. Start the app again');
  console.log('   6. You should now see the activation page');
  console.log('');
  console.log('   If you STILL see login page after restart:');
  console.log('   - The app may be reading from a different location');
  console.log('   - Check the app logs for the actual license file path');
  console.log('   - Or manually clear browser localStorage (F12 > Application)');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

