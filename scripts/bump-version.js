/**
 * Automated Version Bumping Script
 * 
 * Usage:
 *   npm run version:patch    - Bump patch version (1.0.0 → 1.0.1)
 *   npm run version:minor     - Bump minor version (1.0.0 → 1.1.0)
 *   npm run version:major     - Bump major version (1.0.0 → 2.0.0)
 *   npm run version:patch -- --release-notes "Bug fixes and improvements"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const LATEST_YML_PATH = path.join(__dirname, '..', 'release', 'latest.yml');

// Parse command line arguments
const versionType = process.argv[2]; // patch, minor, or major
const releaseNotes = process.argv.find(arg => arg.startsWith('--release-notes='))?.split('=')[1] || '';

if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: patch, minor, or major');
  console.error('\nUsage:');
  console.error('  node scripts/bump-version.js patch');
  console.error('  node scripts/bump-version.js minor');
  console.error('  node scripts/bump-version.js major');
  console.error('\nWith release notes:');
  console.error('  node scripts/bump-version.js patch --release-notes "Bug fixes"');
  process.exit(1);
}

// Read current version
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newVersion;
switch (versionType) {
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
}

console.log('🚀 Automated Version Bump\n');
console.log(`Current version: ${currentVersion}`);
console.log(`New version: ${newVersion}`);
console.log(`Type: ${versionType}\n`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');

// Update latest.yml if it exists
if (fs.existsSync(LATEST_YML_PATH)) {
  let ymlContent = fs.readFileSync(LATEST_YML_PATH, 'utf8');
  
  // Update version
  ymlContent = ymlContent.replace(/^version: .+$/m, `version: ${newVersion}`);
  
  // Update file name in path and url
  const oldFileName = `grocery-pos-${currentVersion}.exe`;
  const newFileName = `grocery-pos-${newVersion}.exe`;
  ymlContent = ymlContent.replace(new RegExp(oldFileName, 'g'), newFileName);
  
  // Update release date
  const newDate = new Date().toISOString();
  ymlContent = ymlContent.replace(/^releaseDate: .+$/m, `releaseDate: '${newDate}'`);
  
  // Add release notes if provided
  if (releaseNotes) {
    // Check if releaseNotes field exists
    if (!ymlContent.includes('releaseNotes:')) {
      // Add releaseNotes after releaseDate
      ymlContent = ymlContent.replace(
        /^(releaseDate: .+)$/m,
        `$1\nreleaseNotes: |\n  ${releaseNotes.split('\n').join('\n  ')}`
      );
    } else {
      // Update existing releaseNotes
      const releaseNotesRegex = /^releaseNotes: \|([\s\S]*?)(?=\n\w|\n$)/m;
      ymlContent = ymlContent.replace(
        releaseNotesRegex,
        `releaseNotes: |\n  ${releaseNotes.split('\n').join('\n  ')}`
      );
    }
  }
  
  fs.writeFileSync(LATEST_YML_PATH, ymlContent);
  console.log('✅ Updated release/latest.yml');
} else {
  console.log('⚠️  latest.yml not found - will be generated on build');
}

console.log('\n📋 Next Steps:');
console.log('1. Build the app: npm run electron:build');
console.log('2. Generate latest.yml: npm run update:generate-yml');
console.log('3. Upload files to server');
console.log('4. Update marketing website releases page\n');

console.log(`✨ Version bumped to ${newVersion}!\n`);

