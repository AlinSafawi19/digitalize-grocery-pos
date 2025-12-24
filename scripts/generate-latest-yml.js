/**
 * Script to generate latest.yml for the current version
 * This helps set up the initial update metadata
 * 
 * Usage: node scripts/generate-latest-yml.js <version> <file-path> <sha512> <size>
 * Example: node scripts/generate-latest-yml.js 1.0.0 grocery-pos-1.0.0.exe abc123... 12345678
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const version = process.argv[2];
const fileName = process.argv[3];
const filePath = process.argv[4]; // Optional: path to the actual file to calculate hash/size

if (!version || !fileName) {
  console.error('Usage: node scripts/generate-latest-yml.js <version> <file-name> [file-path]');
  console.error('Example: node scripts/generate-latest-yml.js 1.0.0 grocery-pos-1.0.0.exe');
  console.error('Or with file path to auto-calculate hash/size:');
  console.error('node scripts/generate-latest-yml.js 1.0.0 grocery-pos-1.0.0.exe ./release/grocery-pos-1.0.0.exe');
  process.exit(1);
}

let sha512 = 'PLACEHOLDER_SHA512';
let size = 'PLACEHOLDER_SIZE';

// If file path is provided, calculate hash and size
if (filePath && fs.existsSync(filePath)) {
  console.log('Calculating SHA512 hash and file size...');
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha512');
  hashSum.update(fileBuffer);
  sha512 = hashSum.digest('hex');
  size = fileBuffer.length;
  console.log(`SHA512: ${sha512}`);
  console.log(`Size: ${size} bytes`);
} else if (filePath) {
  console.warn(`Warning: File not found at ${filePath}. Using placeholders.`);
}

const releaseDate = new Date().toISOString();

const ymlContent = `version: ${version}
files:
  - url: ${fileName}
    sha512: ${sha512}
    size: ${size}
path: ${fileName}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`;

const outputPath = path.join(__dirname, '..', 'release', 'latest.yml');
const releaseDir = path.dirname(outputPath);

// Ensure release directory exists
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

fs.writeFileSync(outputPath, ymlContent);
console.log(`\n✅ Generated latest.yml at: ${outputPath}`);
console.log(`\nNext steps:`);
console.log(`1. If you used placeholders, update the SHA512 and size values`);
console.log(`2. Upload latest.yml to: https://downloads.digitalizepos.com/latest.yml`);
console.log(`3. Upload ${fileName} to: https://downloads.digitalizepos.com/${fileName}`);

