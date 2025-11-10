/* eslint-disable no-undef */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple PNG creation helper (1x1 pixel)
function createSimplePNG(r, g, b) {
  // PNG signature + IHDR + IDAT + IEND
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk (1x1 pixel, 8-bit RGB)
  const ihdr = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0D]), // Length: 13
    Buffer.from('IHDR'),
    Buffer.from([0x00, 0x00, 0x00, 0x01]), // Width: 1
    Buffer.from([0x00, 0x00, 0x00, 0x01]), // Height: 1
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]), // 8-bit RGB, no compression
    Buffer.from([0x90, 0x77, 0x53, 0xDE]), // CRC
  ]);

  // IDAT chunk (compressed pixel data)
  const idat = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0C]), // Length: 12
    Buffer.from('IDAT'),
    Buffer.from([0x08, 0xD7, 0x63, r & 0xFF, g & 0xFF, b & 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
    Buffer.from([0xE2, 0x21, 0xBC, 0x33]), // CRC (placeholder)
  ]);

  // IEND chunk
  const iend = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length: 0
    Buffer.from('IEND'),
    Buffer.from([0xAE, 0x42, 0x60, 0x82]), // CRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const testAssetsDir = path.join(__dirname, '..', 'test-assets');
if (!fs.existsSync(testAssetsDir)) {
  fs.mkdirSync(testAssetsDir, { recursive: true });
}

// Create test textures
const textures = [
  { name: 'test-upload.png', color: [255, 0, 0] },     // Red
  { name: 'albedo.png', color: [0, 255, 0] },          // Green
  { name: 'normal.png', color: [128, 128, 255] },      // Normal map blue
  { name: 'shared.png', color: [255, 255, 0] },        // Yellow
  { name: 'different.png', color: [255, 0, 255] },     // Magenta
];

textures.forEach(({ name, color }) => {
  const filePath = path.join(testAssetsDir, name);
  const png = createSimplePNG(color[0], color[1], color[2]);
  fs.writeFileSync(filePath, png);
  console.log(`✅ Created ${name} (${color.join(', ')})`);
});

console.log(`\n✅ Created ${textures.length} test textures in test-assets/`);
