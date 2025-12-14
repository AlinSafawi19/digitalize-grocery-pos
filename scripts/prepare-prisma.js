const fs = require('fs-extra');
const path = require('path');

// Copy .prisma/client to prisma-client/client for electron-builder
// This creates a visible directory structure that electron-builder can unpack
const source = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
const dest = path.join(__dirname, '..', 'node_modules', 'prisma-client', 'client');

console.log('📦 Preparing Prisma client for packaging...');

if (fs.existsSync(source)) {
  // Ensure destination directory exists
  const destDir = path.dirname(dest);
  fs.ensureDirSync(destDir);
  
  // Remove old copy if it exists
  if (fs.existsSync(dest)) {
    fs.removeSync(dest);
  }
  
  // Copy the client directory
  fs.copySync(source, dest, { overwrite: true });
  console.log('✅ Prisma client copied to visible location:', dest);
  
  // Verify the copy was successful
  if (fs.existsSync(dest)) {
    const defaultFile = path.join(dest, 'default.js');
    if (fs.existsSync(defaultFile)) {
      console.log('✅ Prisma client directory structure verified (default.js found)');
    } else {
      console.warn('⚠️  Prisma client copied but default.js not found');
    }
  }
} else {
  console.error('❌ Prisma client not found at:', source);
  console.log('⚠️  Make sure to run "prisma generate" first');
  process.exit(1);
}

