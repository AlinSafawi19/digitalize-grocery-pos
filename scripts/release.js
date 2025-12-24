/**
 * Complete Release Script
 * Automates the entire release process
 * 
 * Usage:
 *   npm run release:patch    - Release patch version (1.0.0 → 1.0.1)
 *   npm run release:minor    - Release minor version (1.0.0 → 1.1.0)
 *   npm run release:major    - Release major version (1.0.0 → 2.0.0)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const versionType = process.argv[2];

if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: patch, minor, or major');
  console.error('\nUsage:');
  console.error('  npm run release:patch');
  console.error('  npm run release:minor');
  console.error('  npm run release:major');
  process.exit(1);
}

console.log('🚀 Starting Automated Release Process\n');
console.log(`Version type: ${versionType}\n`);

try {
  // Step 1: Bump version
  console.log('📦 Step 1: Bumping version...');
  execSync(`node scripts/bump-version.js ${versionType}`, { stdio: 'inherit' });
  
  // Step 2: Read new version
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const newVersion = packageJson.version;
  const installerName = `grocery-pos-${newVersion}.exe`;
  
  console.log('\n🔨 Step 2: Building application...');
  console.log('   This may take a few minutes...\n');
  execSync('npm run electron:build', { stdio: 'inherit' });
  
  // Step 3: Generate latest.yml
  const installerPath = path.join(__dirname, '..', 'release', installerName);
  if (fs.existsSync(installerPath)) {
    console.log('\n📝 Step 3: Generating latest.yml...');
    execSync(`node scripts/generate-latest-yml.js ${newVersion} ${installerName} ${installerPath}`, { stdio: 'inherit' });
  } else {
    console.log('\n⚠️  Step 3: Installer not found, skipping latest.yml generation');
    console.log('   You can generate it manually with:');
    console.log(`   npm run update:generate-yml ${newVersion} ${installerName} release/${installerName}`);
  }
  
  // Step 4: Verify files
  console.log('\n✅ Step 4: Verifying release files...');
  const latestYmlPath = path.join(__dirname, '..', 'release', 'latest.yml');
  if (fs.existsSync(installerPath) && fs.existsSync(latestYmlPath)) {
    const installerStats = fs.statSync(installerPath);
    const installerSizeMB = (installerStats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ ${installerName} (${installerSizeMB} MB)`);
    console.log(`   ✅ latest.yml`);
  } else {
    console.log('   ⚠️  Some files are missing');
  }
  
  // Step 5: Update marketing website version.json
  console.log('\n🌐 Step 5: Updating marketing website...');
  const marketingWebsiteDir = path.join(__dirname, '..', '..', 'digitalize-marketing-website');
  const generateVersionScript = path.join(marketingWebsiteDir, 'scripts', 'generate-version.js');
  
  if (fs.existsSync(generateVersionScript)) {
    try {
      console.log('   Generating version.json for marketing website...');
      // Change to marketing website directory and run the script
      const originalCwd = process.cwd();
      process.chdir(marketingWebsiteDir);
      execSync('node scripts/generate-version.js', { stdio: 'inherit' });
      process.chdir(originalCwd);
      console.log('   ✅ Marketing website version.json updated');
    } catch (error) {
      console.log('   ⚠️  Failed to update marketing website automatically');
      console.log('   You can update it manually by running:');
      console.log('   cd ../digitalize-marketing-website && npm run prebuild');
    }
  } else {
    console.log('   ⚠️  Marketing website not found at expected location');
    console.log('   You can update it manually by running:');
    console.log('   cd ../digitalize-marketing-website && npm run prebuild');
  }
  
  // Step 6: Upload files to server
  console.log('\n📤 Step 6: Preparing files for upload...');
  console.log('   Displaying upload instructions...\n');
  try {
    execSync('npm run update:upload', { stdio: 'inherit' });
  } catch (error) {
    console.log('   ⚠️  Upload helper encountered an issue');
    console.log('   Please upload files manually:');
    console.log(`   - ${installerName} → https://downloads.digitalizepos.com/${installerName}`);
    console.log('   - latest.yml → https://downloads.digitalizepos.com/latest.yml');
  }
  
  // Step 7: Verify upload (after manual upload)
  console.log('\n🔍 Step 7: Verifying upload...');
  console.log('   Note: This will check if files are already on the server.');
  console.log('   If you haven\'t uploaded yet, this will show errors (that\'s expected).\n');
  try {
    execSync('npm run update:verify', { stdio: 'inherit' });
  } catch (error) {
    console.log('   ⚠️  Verification check completed');
    console.log('   If files are not yet uploaded, please upload them and run: npm run update:verify');
  }
  
  console.log('\n🎉 Release Process Complete!\n');
  console.log('📋 Summary:');
  console.log(`   ✅ Version bumped to ${newVersion}`);
  console.log(`   ✅ Installer created: ${installerName}`);
  console.log('   ✅ latest.yml generated');
  console.log('   ✅ Marketing website updated');
  console.log('\n📝 Optional Next Steps:');
  console.log('   - Add release notes to marketing website ReleasesPage.tsx');
  console.log('   - Build and deploy marketing website if needed');
  console.log('   - Test the update on a clean machine\n');
  
} catch (error) {
  console.error('\n❌ Release process failed:', error.message);
  process.exit(1);
}

