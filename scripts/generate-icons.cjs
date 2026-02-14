const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="200" stroke="#ffffff" stroke-width="32"/>
  <line x1="256" y1="56" x2="256" y2="156" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <line x1="256" y1="356" x2="256" y2="456" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <line x1="56" y1="256" x2="156" y2="256" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <line x1="356" y1="256" x2="456" y2="256" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <path d="M200 200L280 256L200 312" stroke="#ff4136" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcons() {
  const svgBuffer = Buffer.from(svgContent);

  const iconSizes = [
    { size: 32, name: '32x32.png' },
    { size: 128, name: '128x128.png' },
    { size: 256, name: '128x128@2x.png' },
    { size: 256, name: 'icon.png' },
    // Windows Store logos
    { size: 30, name: 'Square30x30Logo.png' },
    { size: 44, name: 'Square44x44Logo.png' },
    { size: 71, name: 'Square71x71Logo.png' },
    { size: 89, name: 'Square89x89Logo.png' },
    { size: 107, name: 'Square107x107Logo.png' },
    { size: 142, name: 'Square142x142Logo.png' },
    { size: 150, name: 'Square150x150Logo.png' },
    { size: 284, name: 'Square284x284Logo.png' },
    { size: 310, name: 'Square310x310Logo.png' },
    { size: 50, name: 'StoreLogo.png' },
  ];

  const pngBuffers = [];

  for (const { size, name } of iconSizes) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    await fs.promises.writeFile(path.join(iconsDir, name), pngBuffer);
    console.log(`Generated ${name}`);
    if (size <= 256) {
      pngBuffers.push(pngBuffer);
    }
  }

  const icoBuffer = await toIco(pngBuffers.slice(0, 4));
  await fs.promises.writeFile(path.join(iconsDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico');

  // Write the SVG as icon.svg
  await fs.promises.writeFile(path.join(iconsDir, 'icon.svg'), svgContent);
  console.log('Generated icon.svg');

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
