const fs = require('fs-extra');
const path = require('path');

// This script runs after electron-builder packages the app
// It copies .prisma/client to the packaged app's node_modules
// electron-builder passes context as the first argument

module.exports = async function(context) {
  // Get project directory from packager or use process.cwd() as fallback
  const projectDir = context.packager?.projectDir || process.cwd();
  const appOutDir = context.appOutDir;
  
  const sourcePrisma = path.join(projectDir, 'node_modules', '.prisma');
  const targetPrisma = path.join(appOutDir, 'resources', 'app', 'node_modules', '.prisma');
  
  console.log('[Post-Pack] Copying Prisma client...');
  console.log('[Post-Pack] Source:', sourcePrisma);
  console.log('[Post-Pack] Target:', targetPrisma);
  
  if (fs.existsSync(sourcePrisma)) {
    try {
      // Ensure target directory exists
      fs.ensureDirSync(path.dirname(targetPrisma));
      
      // Remove old copy if exists
      if (fs.existsSync(targetPrisma)) {
        fs.removeSync(targetPrisma);
      }
      
      // Copy entire .prisma directory
      fs.copySync(sourcePrisma, targetPrisma);
      
      // Verify the copy
      const defaultJs = path.join(targetPrisma, 'client', 'default.js');
      if (fs.existsSync(defaultJs)) {
        console.log('[Post-Pack] ✅ Prisma client copied successfully');
      } else {
        console.error('[Post-Pack] ❌ Prisma client copied but default.js not found');
        throw new Error('Prisma client copy verification failed');
      }
    } catch (error) {
      console.error('[Post-Pack] ❌ Error copying Prisma client:', error);
      throw error;
    }
  } else {
    console.error('[Post-Pack] ❌ Source Prisma client not found at:', sourcePrisma);
    throw new Error(`Prisma client not found at ${sourcePrisma}`);
  }
};

