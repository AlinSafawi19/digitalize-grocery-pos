/**
 * Script to upload update files to the server
 * Supports multiple upload methods
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

const SERVER_URL = 'https://downloads.digitalizepos.com';
const FILES_TO_UPLOAD = [
  { local: 'release/latest.yml', remote: 'latest.yml' },
  { local: `release/grocery-pos-${VERSION}.exe`, remote: `grocery-pos-${VERSION}.exe` },
];

// Check if files exist
function checkFiles() {
  console.log('📁 Checking files...\n');
  const missing = [];
  
  FILES_TO_UPLOAD.forEach(({ local, remote }) => {
    const fullPath = path.join(__dirname, '..', local);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   ✅ ${local} (${sizeMB} MB)`);
    } else {
      console.log(`   ❌ ${local} (NOT FOUND)`);
      missing.push(local);
    }
  });
  
  if (missing.length > 0) {
    console.log(`\n❌ Missing files: ${missing.join(', ')}`);
    console.log('Please ensure all files exist before uploading.\n');
    process.exit(1);
  }
  
  console.log('\n✅ All files found!\n');
}

// Method 1: Using curl (if available)
function uploadWithCurl() {
  console.log('📤 Attempting upload with curl...\n');
  
  const { execSync } = require('child_process');
  
  FILES_TO_UPLOAD.forEach(({ local, remote }) => {
    const fullPath = path.resolve(__dirname, '..', local);
    const remoteUrl = `${SERVER_URL}/${remote}`;
    
    try {
      console.log(`Uploading ${local}...`);
      // Note: This is a placeholder - actual curl command would need authentication
      console.log(`   Would upload to: ${remoteUrl}`);
      console.log(`   ⚠️  curl upload requires authentication - please use FTP/SFTP or manual upload`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  });
}

// Display upload instructions
function showInstructions() {
  console.log('📋 Upload Instructions:\n');
  console.log('Since automatic upload requires server credentials, please upload manually:\n');
  
  FILES_TO_UPLOAD.forEach(({ local, remote }) => {
    const fullPath = path.resolve(__dirname, '..', local);
    console.log(`1. ${local}`);
    console.log(`   Local: ${fullPath}`);
    console.log(`   Upload to: ${SERVER_URL}/${remote}\n`);
  });
  
  console.log('Upload Methods:');
  console.log('1. FTP/SFTP Client (FileZilla, WinSCP, etc.)');
  console.log('2. Web Hosting Control Panel (cPanel, Plesk)');
  console.log('3. SSH/SCP (if you have SSH access)');
  console.log('4. Direct file manager on your server\n');
  
  console.log('After uploading, verify with:');
  console.log('   npm run update:verify\n');
}

// Main
function main() {
  console.log('🚀 Update Files Upload Helper\n');
  console.log(`Server: ${SERVER_URL}\n`);
  
  checkFiles();
  
  // Check if we have upload credentials in environment
  const hasCredentials = process.env.UPDATE_SERVER_USER || process.env.UPDATE_SERVER_PASS;
  
  if (hasCredentials) {
    console.log('⚠️  Credentials found in environment, but automatic upload not yet implemented.');
    console.log('Please use one of the manual methods below.\n');
  }
  
  showInstructions();
  
  // Open file locations
  console.log('💡 Tip: The files are ready in the release/ folder.');
  console.log('   You can drag and drop them to your FTP client or file manager.\n');
}

main();

