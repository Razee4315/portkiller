const path = require('path');
const { execSync } = require('child_process');

const exePath = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'PortKiller.exe');
const icoPath = path.join(__dirname, '..', 'src-tauri', 'icons', 'icon.ico');
const rceditPath = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

try {
  console.log('Embedding icon into exe...');
  execSync(`"${rceditPath}" "${exePath}" --set-icon "${icoPath}"`, { stdio: 'inherit' });
  console.log('Icon embedded successfully!');
} catch (err) {
  console.error('Failed to embed icon:', err.message);
  process.exit(1);
}
