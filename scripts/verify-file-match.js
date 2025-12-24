/**
 * Script to verify if the server file matches the local file
 * Compares SHA512 hash and size
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

const SERVER_URL = 'https://downloads.digitalizepos.com';
const LOCAL_FILE = path.join(__dirname, '..', 'release', `grocery-pos-${VERSION}.exe`);
const SERVER_FILE = `${SERVER_URL}/grocery-pos-${VERSION}.exe`;

// Try to read expected hash/size from latest.yml if it exists
let EXPECTED_HASH = null;
let EXPECTED_SIZE = null;
const latestYmlPath = path.join(__dirname, '..', 'release', 'latest.yml');
if (fs.existsSync(latestYmlPath)) {
  const ymlContent = fs.readFileSync(latestYmlPath, 'utf8');
  const hashMatch = ymlContent.match(/sha512:\s*([a-f0-9]+)/);
  const sizeMatch = ymlContent.match(/size:\s*(\d+)/);
  if (hashMatch) EXPECTED_HASH = hashMatch[1];
  if (sizeMatch) EXPECTED_SIZE = parseInt(sizeMatch[1], 10);
}

function calculateHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha512');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

async function verifyMatch() {
  console.log('🔍 Verifying if server file matches local file...\n');
  
  // Check local file
  if (!fs.existsSync(LOCAL_FILE)) {
    console.log(`❌ Local file not found: ${LOCAL_FILE}`);
    return;
  }
  
  console.log('📁 Local file:');
  const localHash = calculateHash(LOCAL_FILE);
  const localSize = getFileSize(LOCAL_FILE);
  console.log(`   Hash: ${localHash.substring(0, 20)}...`);
  console.log(`   Size: ${localSize} bytes (${(localSize / 1024 / 1024).toFixed(2)} MB)\n`);
  
  // Check server file
  console.log('🌐 Server file:');
  try {
    console.log(`   Downloading from ${SERVER_FILE}...`);
    const serverBuffer = await downloadFile(SERVER_FILE);
    const serverHash = crypto.createHash('sha512').update(serverBuffer).digest('hex');
    const serverSize = serverBuffer.length;
    
    console.log(`   Hash: ${serverHash.substring(0, 20)}...`);
    console.log(`   Size: ${serverSize} bytes (${(serverSize / 1024 / 1024).toFixed(2)} MB)\n`);
    
    // Compare
    console.log('🔎 Comparison:');
    const hashMatch = localHash === serverHash;
    const sizeMatch = localSize === serverSize;
    
    if (hashMatch) {
      console.log('   ✅ Hashes MATCH');
    } else {
      console.log('   ❌ Hashes DO NOT MATCH');
    }
    
    if (sizeMatch) {
      console.log('   ✅ Sizes MATCH');
    } else {
      console.log('   ❌ Sizes DO NOT MATCH');
    }
    
    console.log('');
    
    if (hashMatch && sizeMatch) {
      console.log('✅ FILES MATCH!');
      console.log('   You only need to upload latest.yml\n');
      console.log('📤 Next step:');
      console.log('   Upload: release/latest.yml');
      console.log('   To: https://downloads.digitalizepos.com/latest.yml\n');
    } else {
      console.log('❌ FILES DO NOT MATCH!');
      console.log('   The server file is different from your local file.\n');
      console.log('📤 Options:');
      console.log('   1. Upload both files (replace server file)');
      console.log('   2. Regenerate latest.yml for the existing server file\n');
    }
    
    // Also check against expected values from latest.yml (if available)
    if (EXPECTED_HASH || EXPECTED_SIZE) {
      console.log('📋 Checking against latest.yml values:');
      if (EXPECTED_HASH) {
        if (serverHash === EXPECTED_HASH) {
          console.log('   ✅ Server hash matches latest.yml');
        } else {
          console.log('   ❌ Server hash does NOT match latest.yml');
          console.log('   ⚠️  You need to regenerate latest.yml for the server file');
        }
      }
      
      if (EXPECTED_SIZE) {
        if (serverSize === EXPECTED_SIZE) {
          console.log('   ✅ Server size matches latest.yml');
        } else {
          console.log('   ❌ Server size does NOT match latest.yml');
        }
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log('\n💡 Could not download server file. Possible reasons:');
    console.log('   - File not accessible');
    console.log('   - Network issue');
    console.log('   - Server requires authentication\n');
    console.log('📤 Recommendation:');
    console.log('   If you\'re sure the server file is the same, just upload latest.yml');
    console.log('   If unsure, upload both files to be safe\n');
  }
}

verifyMatch().catch(console.error);

