const fs = require('fs-extra');
const path = require('path');

// This script runs after electron-builder packages the app
// It copies .prisma/client to the packaged app's node_modules
// electron-builder passes context as the first argument

module.exports = async function(context) {
  // Get project directory from packager or use process.cwd() as fallback
  const projectDir = context.packager?.projectDir || process.cwd();
  const appOutDir = context.appOutDir;
  
  // Try multiple source locations
  const possibleSources = [
    path.join(projectDir, 'node_modules', '.prisma'),
    path.join(projectDir, 'node_modules', '@prisma', 'client', '..', '.prisma'),
  ];
  
  let sourcePrisma = null;
  for (const source of possibleSources) {
    if (fs.existsSync(source)) {
      sourcePrisma = source;
      break;
    }
  }
  
  // Target location in packaged app (ASAR is disabled, so files are directly in resources/app)
  const targetPrisma = path.join(appOutDir, 'resources', 'app', 'node_modules', '.prisma');
  
  console.log('[Post-Pack] Copying Prisma client...');
  console.log('[Post-Pack] Source:', sourcePrisma || 'NOT FOUND');
  console.log('[Post-Pack] Target:', targetPrisma);
  
  if (!sourcePrisma || !fs.existsSync(sourcePrisma)) {
    console.error('[Post-Pack] ❌ Source Prisma client not found. Tried:');
    possibleSources.forEach(src => console.error(`  - ${src} (exists: ${fs.existsSync(src)})`));
    throw new Error(`Prisma client not found. Make sure to run 'prisma generate' before building.`);
  }

  try {
    // Ensure target directory exists
    fs.ensureDirSync(path.dirname(targetPrisma));
    
    // Remove old copy if exists
    if (fs.existsSync(targetPrisma)) {
      fs.removeSync(targetPrisma);
    }
    
    // Copy entire .prisma directory with all its contents
    fs.copySync(sourcePrisma, targetPrisma, {
      overwrite: true,
      filter: (src) => {
        // Copy everything, including hidden files
        return true;
      }
    });
    
    console.log('[Post-Pack] ✅ Copied Prisma client to app directory');
    
    // Verify the copy - check for critical files
    const defaultJs = path.join(targetPrisma, 'client', 'default.js');
    const indexJs = path.join(targetPrisma, 'client', 'index.js');
    
    const criticalFiles = [
      { path: defaultJs, name: 'default.js' },
      { path: indexJs, name: 'index.js' },
    ];
    
    let allFilesExist = true;
    for (const file of criticalFiles) {
      if (!fs.existsSync(file.path)) {
        console.error(`[Post-Pack] ❌ Critical file missing: ${file.name} at ${file.path}`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      console.log('[Post-Pack] ✅ Prisma client copied successfully');
      console.log(`[Post-Pack] ✅ Verified: default.js exists at ${defaultJs}`);
      
      // Also ensure @prisma/client package is in the app directory
      const sourcePrismaClient = path.join(projectDir, 'node_modules', '@prisma', 'client');
      const targetPrismaClient = path.join(appOutDir, 'resources', 'app', 'node_modules', '@prisma', 'client');
      
      if (!fs.existsSync(targetPrismaClient)) {
        console.log('[Post-Pack] Copying @prisma/client package...');
        if (fs.existsSync(sourcePrismaClient)) {
          // Ensure @prisma directory exists
          fs.ensureDirSync(path.dirname(targetPrismaClient));
          
          // Copy the entire @prisma/client package
          fs.copySync(sourcePrismaClient, targetPrismaClient, {
            overwrite: true,
            filter: (src) => {
              // Copy everything except test files
              return !src.includes('test') && !src.includes('spec');
            }
          });
          
          // Verify the copy
          const clientIndex = path.join(targetPrismaClient, 'index.js');
          if (fs.existsSync(clientIndex)) {
            console.log('[Post-Pack] ✅ @prisma/client package copied');
          } else {
            console.warn('[Post-Pack] ⚠️  @prisma/client package copied but index.js not found');
          }
        } else {
          console.warn('[Post-Pack] ⚠️  Source @prisma/client package not found at:', sourcePrismaClient);
          console.warn('[Post-Pack] ⚠️  This might cause module resolution issues');
        }
      } else {
        console.log('[Post-Pack] ✅ @prisma/client package already exists');
      }
    } else {
      console.error('[Post-Pack] ❌ Prisma client copy verification failed');
      throw new Error('Prisma client copy verification failed - critical files missing');
    }
  } catch (error) {
    console.error('[Post-Pack] ❌ Error copying Prisma client:', error);
    throw error;
  }
};

