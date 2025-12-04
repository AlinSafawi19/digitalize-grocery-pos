const sharp = require('sharp');
const toIco = require('to-ico');
const { join } = require('path');
const { existsSync, mkdirSync, writeFileSync } = require('fs');

const projectRoot = __dirname.replace(/[\\/]scripts$/, '');
const svgPath = join(projectRoot, 'public', 'favicon.svg');
const publicDir = join(projectRoot, 'public');
const assetsDir = join(projectRoot, 'assets');

// Ensure directories exist
if (!existsSync(assetsDir)) {
  mkdirSync(assetsDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('Generating icons from SVG...');
    
    if (!existsSync(svgPath)) {
      throw new Error(`SVG file not found at: ${svgPath}`);
    }

    // Generate PNG in multiple sizes for ICO
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    console.log('Creating PNG buffers for different sizes...');
    for (const size of sizes) {
      const buffer = await sharp(svgPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }

    // Create high-resolution PNG (512x512) for general use
    console.log('Creating icon.png (512x512)...');
    const iconPng512 = await sharp(svgPath)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Save PNG to public directory (for runtime use)
    writeFileSync(join(publicDir, 'icon.png'), iconPng512);
    console.log('✓ Created public/icon.png');

    // Save PNG to assets directory (for electron-builder Linux)
    writeFileSync(join(assetsDir, 'icon.png'), iconPng512);
    console.log('✓ Created assets/icon.png');

    // Create ICO file with multiple sizes
    console.log('Creating icon.ico with multiple sizes...');
    const icoBuffer = await toIco(pngBuffers);
    
    // Save ICO to public directory (for Windows runtime)
    writeFileSync(join(publicDir, 'icon.ico'), icoBuffer);
    console.log('✓ Created public/icon.ico');

    // Save ICO to assets directory (for electron-builder Windows)
    writeFileSync(join(assetsDir, 'icon.ico'), icoBuffer);
    console.log('✓ Created assets/icon.ico');

    // For macOS, we need ICNS file
    // ICNS is more complex, but we can create a basic one or use a tool
    // For now, create a high-res PNG that can be converted to ICNS manually
    // or use electron-builder's built-in conversion
    console.log('Creating icon.icns placeholder...');
    // electron-builder can convert PNG to ICNS automatically, so we'll create a high-res PNG
    const iconPng1024 = await sharp(svgPath)
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Save as icon.png in assets (electron-builder will convert this to .icns for macOS)
    // Actually, electron-builder expects icon.icns, but it can also work with icon.png
    // For proper ICNS, we'd need a specialized tool, but electron-builder handles this
    writeFileSync(join(assetsDir, 'icon.icns.png'), iconPng1024);
    console.log('✓ Created assets/icon.icns.png (electron-builder will convert to .icns)');
    console.log('  Note: For macOS builds, you may need to manually convert this to .icns');
    console.log('  or electron-builder will handle it automatically if configured correctly.');

    console.log('\n✅ All icons generated successfully!');
    console.log('\nGenerated files:');
    console.log('  - public/icon.png (512x512) - for runtime use');
    console.log('  - public/icon.ico (multi-size) - for Windows runtime');
    console.log('  - assets/icon.png (512x512) - for Linux builds');
    console.log('  - assets/icon.ico (multi-size) - for Windows builds');
    console.log('  - assets/icon.icns.png (1024x1024) - for macOS builds (needs conversion to .icns)');

  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

