import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { PrismaClient } from '@prisma/client';

/**
 * Get Electron userData path without Electron app context
 * This matches Electron's app.getPath('userData') behavior
 * 
 * IMPORTANT: Electron uses package.json "name" field for userData directory
 * We need to read it from package.json to match exactly
 */
function getUserDataPath(): string {
  // Read app name from package.json (this is what Electron uses)
  let appName = 'digitalize-grocery-pos'; // Default fallback
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.pathExistsSync(packageJsonPath)) {
      const packageJson = fs.readJsonSync(packageJsonPath);
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

// ALWAYS use the app's database path (userData/database/digitalizePOS.db)
// NOT the project's prisma/database/digitalizePOS.db
// This ensures we clear the same database the app actually uses
const userDataPath = getUserDataPath();
const dbPath = path.join(userDataPath, 'database', 'digitalizePOS.db');

// Also check for alternative app name variations (in case app name changed over time)
// This handles cases where the app name might have been different in previous versions
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const possibleAppNames = [
  'digitalize-grocery-pos'
];
const alternativeDbPaths = possibleAppNames
  .filter(name => name !== path.basename(userDataPath)) // Don't duplicate the primary path
  .map(name => path.join(appData, name, 'database', 'digitalizePOS.db'));

// Use the primary path for Prisma
process.env.DATABASE_URL = `file:${dbPath}`;

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
fs.ensureDirSync(dbDir);

console.log(`📁 Using app database: ${dbPath}`);
console.log('   (This is the database the app actually uses)');
console.log('');

const prisma = new PrismaClient();

/**
 * Search for license files in common locations
 */
async function searchForLicenseFiles(): Promise<string[]> {
  const possiblePaths: string[] = [];
  
  // Standard userData path
  const userDataPath = getUserDataPath();
  possiblePaths.push(path.join(userDataPath, 'license', 'license.dat'));
  possiblePaths.push(path.join(userDataPath, 'license', 'credentials.dat'));
  
  // Also check if there's a different app name variant
  const appNameVariants = ['digitalize-grocery-pos'];
  const platform = process.platform;
  const homedir = os.homedir();
  
  for (const appName of appNameVariants) {
    let variantPath: string;
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
async function clearLicenseFiles(): Promise<void> {
  try {
    const userDataPath = getUserDataPath();
    const licenseDir = path.join(userDataPath, 'license');
    const licenseFile = path.join(licenseDir, 'license.dat');
    const credentialsFile = path.join(licenseDir, 'credentials.dat');

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
    // Don't fail the seed process if license files can't be cleared
  }
}

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log('');
  console.log('⚠️  IMPORTANT: Make sure the DigitalizePOS Grocery POS app is COMPLETELY CLOSED!');
  console.log('   The app caches license status in memory.');
  console.log('   You MUST close the app before seeding, then restart it after.');
  console.log('');

  // Check if database file exists and show its size
  if (await fs.pathExists(dbPath)) {
    const stats = await fs.stat(dbPath);
    console.log(`📁 Database file exists: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.log('📁 Database file does not exist yet (will be created on first app run)');
  }
  console.log('');

  // NUCLEAR OPTION: Delete the entire database file to ensure it's completely clean
  // This is more aggressive but ensures no data persists
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
      console.log(`   ⚠️  Found database file (${db.name}) - deleting it completely...`);
      try {
        // Close Prisma connection first (only once)
        if (!deletedAny) {
          await prisma.$disconnect();
        }
        
        // Delete the database file and any associated files (like .db-wal, .db-shm for SQLite)
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
        console.log('   Try closing the app completely and running the seed script again.');
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
        console.log('   The seed script may not have worked correctly.');
        console.log('   Make sure the app is completely closed before running the seed script.');
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
    console.log('   ℹ No database files found in either location (already clean)');
    // Continue to clear license files
  }
  
  // Legacy code path - if we couldn't delete files, try clearing tables
  // (This shouldn't happen if databases were deleted, but keeping for safety)
  if (await fs.pathExists(dbPath)) {
    console.log('   ⚠️  Database file exists - deleting it completely...');
    try {
      // Close Prisma connection first
      await prisma.$disconnect();
      
      // Delete the database file and any associated files (like .db-wal, .db-shm for SQLite)
      await fs.remove(dbPath);
      
      // Also delete SQLite journal files if they exist
      const walFile = dbPath + '-wal';
      const shmFile = dbPath + '-shm';
      if (await fs.pathExists(walFile)) {
        await fs.remove(walFile);
        console.log('   ✓ Deleted SQLite WAL file');
      }
      if (await fs.pathExists(shmFile)) {
        await fs.remove(shmFile);
        console.log('   ✓ Deleted SQLite SHM file');
      }
      
      // Also check for any backup database files in the same directory
      const dbDir = path.dirname(dbPath);
      try {
        const files = await fs.readdir(dbDir);
        const backupFiles = files
          .filter(f => typeof f === 'string')
          .filter(f => 
            f.includes('digitalizePOS') && 
            (f.endsWith('.db') || f.endsWith('.db-backup') || f.endsWith('.bak'))
          );
        
        if (backupFiles.length > 0) {
          console.log(`   ⚠️  Found ${backupFiles.length} potential backup database file(s):`);
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
      
      console.log('   ✓ Database file deleted completely');
      console.log('   ✓ SQLite journal files deleted (if any)');
      console.log('   ℹ A new empty database will be created when the app runs');
      
      // Verify the file is actually gone
      if (await fs.pathExists(dbPath)) {
        console.log('   ❌ ERROR: Database file still exists after deletion attempt!');
        console.log('   Try closing the app completely and running the seed script again.');
      } else {
        console.log('   ✓ Verified: Database file is actually deleted');
      }
      
      console.log('');
      console.log('✅ Database cleared successfully!');
      console.log('');
      
      // Continue to clear license files, then exit
      await clearLicenseFiles();
      
      // Verify
      console.log('');
      console.log('🔍 Verifying everything is cleared...');
      if (await fs.pathExists(dbPath)) {
        console.log('   ❌ WARNING: Database file still exists!');
        console.log('   The seed script may not have worked correctly.');
        console.log('   Make sure the app is completely closed before running the seed script.');
      } else {
        console.log('   ✓ Verified: Database file deleted (completely clean)');
        console.log('   ✓ Verified: No users can exist (database doesn\'t exist)');
        console.log('   ✓ Credentials will be created on next activation');
      }
      
      return; // Exit early since database is deleted
    } catch (error) {
      console.log('   ⚠️  Could not delete database file, will try clearing tables instead');
      console.log(`      Error: ${error instanceof Error ? error.message : error}`);
      // Reconnect Prisma for table clearing
      // Note: Prisma client is already created, we just need to reconnect
    }
  } else {
    console.log('   ℹ Database file does not exist (already clean)');
    // Continue to clear license files
  }
  
  // If we get here, we couldn't delete the file, so try clearing tables
  // Helper function to safely delete from a table (handles case where table doesn't exist)
  const safeDelete = async (model: any, name: string) => {
    try {
      await model.deleteMany();
      return true;
    } catch (error: any) {
      // P2021 = Table does not exist (database not initialized yet)
      if (error.code === 'P2021') {
        return false; // Table doesn't exist, skip
      }
      throw error; // Re-throw other errors
    }
  };
  
  // Delete child tables first (those with foreign keys)
  // Use safeDelete to handle case where database is new/empty
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

  console.log('✅ Database cleared successfully!');
  console.log('');
  
  // Clear license files (this will force the app to show activation page)
  await clearLicenseFiles();
  
  // Verify files are actually gone
  console.log('');
  console.log('🔍 Verifying everything is cleared...');
  try {
    // Check all possible locations for license files
    const allPossiblePaths = await searchForLicenseFiles();
    const existingFiles: string[] = [];
    
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
        console.log('   This should not happen - the seed script should have cleared all users.');
      } else {
        console.log('   ✓ Verified: Database has no users (credentials will be created on activation)');
      }
    } catch (error: any) {
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
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

