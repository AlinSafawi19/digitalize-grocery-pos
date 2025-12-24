/**
 * Script to verify that the update server is properly configured
 * Checks if latest.yml and installer files are accessible
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

const UPDATE_SERVER = 'https://downloads.digitalizepos.com';
const INSTALLER_NAME = `grocery-pos-${VERSION}.exe`;

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          success: res.statusCode === 200,
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function verifyUpdateServer() {
  console.log('🔍 Verifying Update Server Configuration...\n');
  console.log(`Server: ${UPDATE_SERVER}\n`);
  
  // Check latest.yml
  console.log('1. Checking latest.yml...');
  let serverVersion = null;
  let serverInstallerName = null;
  try {
    const ymlUrl = `${UPDATE_SERVER}/latest.yml`;
    const result = await checkUrl(ymlUrl);
    
    if (result.success) {
      console.log('   ✅ latest.yml is accessible');
      console.log(`   Status: ${result.statusCode}`);
      console.log(`   Content-Type: ${result.headers['content-type'] || 'unknown'}`);
      
      // Parse YAML content to extract version
      const versionMatch = result.data.match(/^version:\s*(.+)$/m);
      const pathMatch = result.data.match(/^path:\s*(.+)$/m);
      
      if (versionMatch) {
        serverVersion = versionMatch[1].trim();
        console.log(`   📦 Server version: ${serverVersion}`);
        
        if (serverVersion === VERSION) {
          console.log(`   ✅ Server version matches expected version ${VERSION}`);
        } else {
          console.log(`   ⚠️  Server version (${serverVersion}) does NOT match expected version (${VERSION})`);
        }
      }
      
      if (pathMatch) {
        serverInstallerName = pathMatch[1].trim();
        console.log(`   📁 Server installer: ${serverInstallerName}`);
      }
    } else {
      console.log(`   ❌ latest.yml returned status ${result.statusCode}`);
      console.log(`   URL: ${ymlUrl}`);
    }
  } catch (error) {
    console.log(`   ❌ Error accessing latest.yml: ${error.message}`);
    console.log(`   URL: ${UPDATE_SERVER}/latest.yml`);
  }
  
  console.log('');
  
  // Check installer file
  console.log('\n2. Checking installer file...');
  const installerToCheck = serverInstallerName || INSTALLER_NAME;
  let installerAccessible = false;
  try {
    const installerUrl = `${UPDATE_SERVER}/${installerToCheck}`;
    const result = await checkUrl(installerUrl);
    
    if (result.success) {
      installerAccessible = true;
      console.log('   ✅ Installer file is accessible');
      console.log(`   Status: ${result.statusCode}`);
      console.log(`   Content-Type: ${result.headers['content-type'] || 'unknown'}`);
      const contentLength = result.headers['content-length'];
      if (contentLength) {
        const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
        console.log(`   Size: ${sizeMB} MB`);
      }
      
      if (installerToCheck === INSTALLER_NAME) {
        console.log(`   ✅ Installer matches expected version ${VERSION}`);
      } else {
        console.log(`   ⚠️  Installer on server (${installerToCheck}) differs from expected (${INSTALLER_NAME})`);
      }
    } else {
      console.log(`   ❌ Installer returned status ${result.statusCode}`);
      console.log(`   URL: ${installerUrl}`);
      if (result.statusCode === 404) {
        console.log(`   📤 Action needed: Upload ${INSTALLER_NAME} to the server`);
        const localPath = path.join(__dirname, '..', 'release', INSTALLER_NAME);
        if (fs.existsSync(localPath)) {
          const stats = fs.statSync(localPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
          console.log(`   📁 Local file exists: ${localPath} (${sizeMB} MB)`);
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Error accessing installer: ${error.message}`);
    console.log(`   URL: ${UPDATE_SERVER}/${installerToCheck}`);
  }
  
  console.log('\n📋 Summary:');
  const latestYmlOk = serverVersion !== null;
  
  if (latestYmlOk && serverVersion === VERSION) {
    console.log('   ✅ latest.yml is correctly configured for version ' + VERSION);
  } else if (latestYmlOk) {
    console.log(`   ⚠️  latest.yml exists but points to version ${serverVersion} (expected ${VERSION})`);
  } else {
    console.log('   ❌ latest.yml is not accessible or invalid');
  }
  
  if (installerAccessible && installerToCheck === INSTALLER_NAME) {
    console.log(`   ✅ Installer file is accessible and matches version ${VERSION}`);
  } else if (installerAccessible) {
    console.log(`   ⚠️  Installer file is accessible but points to ${installerToCheck} (expected ${INSTALLER_NAME})`);
  } else {
    console.log(`   ❌ Installer file is not accessible on the server`);
  }
  
  console.log('\n📝 Next Steps:');
  if (serverVersion === VERSION && installerAccessible && installerToCheck === INSTALLER_NAME) {
    console.log('   ✅ Both latest.yml and installer are correctly configured!');
    console.log(`   1. Install version ${VERSION} on a test machine`);
    console.log('   2. Open the app and wait 30 seconds');
    console.log(`   3. The app should check for updates (no notification if ${VERSION} is latest)`);
    console.log('   4. When you release a new version, users will be notified automatically');
  } else {
    if (serverVersion !== VERSION) {
      console.log(`   📝 Update latest.yml to point to version ${VERSION}`);
      console.log(`      Run: npm run update:generate-yml ${VERSION} ${INSTALLER_NAME} release/${INSTALLER_NAME}`);
    }
    if (!installerAccessible || installerToCheck !== INSTALLER_NAME) {
      console.log(`   📤 Upload installer file: ${INSTALLER_NAME}`);
      const localPath = path.join(__dirname, '..', 'release', INSTALLER_NAME);
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`      Local file: ${localPath} (${sizeMB} MB)`);
      }
      console.log(`      Run: npm run update:upload (for instructions)`);
    }
  }
}

verifyUpdateServer().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

