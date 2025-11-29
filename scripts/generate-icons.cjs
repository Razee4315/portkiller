const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a"/>
      <stop offset="100%" style="stop-color:#0d0d0d"/>
    </linearGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ef4444"/>
      <stop offset="100%" style="stop-color:#dc2626"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <circle cx="128" cy="128" r="80" fill="none" stroke="url(#ring)" stroke-width="12"/>
  <line x1="88" y1="88" x2="168" y2="168" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="168" y1="88" x2="88" y2="168" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
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
  ];
  
  const pngBuffers = [];
  
  for (const { size, name } of iconSizes) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    await fs.promises.writeFile(path.join(iconsDir, name), pngBuffer);
    console.log(`Generated ${name}`);
    pngBuffers.push(pngBuffer);
  }
  
  const icoBuffer = await toIco(pngBuffers);
  await fs.promises.writeFile(path.join(iconsDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico');
  
  await fs.promises.writeFile(path.join(iconsDir, 'icon.icns'), Buffer.alloc(8));
  console.log('Created placeholder icon.icns');
  
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
