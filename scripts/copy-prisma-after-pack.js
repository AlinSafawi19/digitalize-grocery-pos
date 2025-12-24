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
  
  // Target locations in packaged app
  // Need to copy to both ASAR location and unpacked location
  const targetPrismaAsar = path.join(appOutDir, 'resources', 'app', 'node_modules', '.prisma');
  const targetPrismaUnpacked = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '.prisma');
  
  console.log('[Post-Pack] Copying Prisma client...');
  console.log('[Post-Pack] Source:', sourcePrisma || 'NOT FOUND');
  console.log('[Post-Pack] Target (ASAR):', targetPrismaAsar);
  console.log('[Post-Pack] Target (Unpacked):', targetPrismaUnpacked);
  
  if (!sourcePrisma || !fs.existsSync(sourcePrisma)) {
    console.error('[Post-Pack] ❌ Source Prisma client not found. Tried:');
    possibleSources.forEach(src => console.error(`  - ${src} (exists: ${fs.existsSync(src)})`));
    throw new Error(`Prisma client not found. Make sure to run 'prisma generate' before building.`);
  }
  
  try {
    // Copy to both ASAR and unpacked locations
    const copyToLocation = (targetPath, locationName) => {
      // Ensure target directory exists
      fs.ensureDirSync(path.dirname(targetPath));
      
      // Remove old copy if exists
      if (fs.existsSync(targetPath)) {
        fs.removeSync(targetPath);
      }
      
      // Copy entire .prisma directory with all its contents
      fs.copySync(sourcePrisma, targetPath, {
        overwrite: true,
        filter: (src) => {
          // Copy everything, including hidden files
          return true;
        }
      });
      
      console.log(`[Post-Pack] ✅ Copied to ${locationName}`);
    };
    
    // Copy to ASAR location
    copyToLocation(targetPrismaAsar, 'ASAR location');
    
    // Copy to unpacked location (critical for runtime resolution)
    copyToLocation(targetPrismaUnpacked, 'unpacked location');
    
    // Verify the copy - check for critical files in unpacked location (where it will be used)
    const defaultJs = path.join(targetPrismaUnpacked, 'client', 'default.js');
    const indexJs = path.join(targetPrismaUnpacked, 'client', 'index.js');
    const indexBrowserJs = path.join(targetPrismaUnpacked, 'client', 'index-browser.js');
    
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
      
      // Also copy @prisma/client package to both locations
      const sourcePrismaClient = path.join(projectDir, 'node_modules', '@prisma', 'client');
      const targetPrismaClientAsar = path.join(appOutDir, 'resources', 'app', 'node_modules', '@prisma', 'client');
      const targetPrismaClientUnpacked = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@prisma', 'client');
      
      const copyPrismaClientPackage = (targetPath, locationName) => {
        if (!fs.existsSync(targetPath)) {
          console.log(`[Post-Pack] Copying @prisma/client package to ${locationName}...`);
          if (fs.existsSync(sourcePrismaClient)) {
            // Ensure @prisma directory exists
            fs.ensureDirSync(path.dirname(targetPath));
            
            // Copy the entire @prisma/client package
            fs.copySync(sourcePrismaClient, targetPath, {
              overwrite: true,
              filter: (src) => {
                // Copy everything except test files
                return !src.includes('test') && !src.includes('spec');
              }
            });
            
            // Verify the copy
            const clientIndex = path.join(targetPath, 'index.js');
            if (fs.existsSync(clientIndex)) {
              console.log(`[Post-Pack] ✅ @prisma/client package copied to ${locationName}`);
            } else {
              console.warn(`[Post-Pack] ⚠️  @prisma/client package copied to ${locationName} but index.js not found`);
            }
          } else {
            console.warn('[Post-Pack] ⚠️  Source @prisma/client package not found at:', sourcePrismaClient);
            console.warn('[Post-Pack] ⚠️  This might cause module resolution issues');
          }
        } else {
          console.log(`[Post-Pack] ✅ @prisma/client package already exists in ${locationName}`);
        }
      };
      
      // Copy to ASAR location
      copyPrismaClientPackage(targetPrismaClientAsar, 'ASAR location');
      
      // Copy to unpacked location (critical for runtime)
      copyPrismaClientPackage(targetPrismaClientUnpacked, 'unpacked location');
    } else {
      console.error('[Post-Pack] ❌ Prisma client copy verification failed');
      throw new Error('Prisma client copy verification failed - critical files missing');
    }
  } catch (error) {
    console.error('[Post-Pack] ❌ Error copying Prisma client:', error);
    throw error;
  }
};

