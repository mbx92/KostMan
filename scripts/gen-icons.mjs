import sharp from 'sharp';
import { readFileSync } from 'fs';

const svgBuffer = readFileSync('public/favicon.svg');

const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-maskable-192x192.png', size: 192, padding: true },
  { name: 'icon-maskable-512x512.png', size: 512, padding: true },
];

for (const { name, size, padding } of sizes) {
  if (padding) {
    const pad = Math.round(size * 0.1);
    const inner = size - pad * 2;
    const b64 = Buffer.from(svgBuffer).toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#22C55E"/><image href="data:image/svg+xml;base64,${b64}" x="${pad}" y="${pad}" width="${inner}" height="${inner}"/></svg>`;
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}`);
  } else {
    await sharp(svgBuffer).resize(size, size).png().toFile(`public/icons/${name}`);
  }
  console.log(`Generated ${name}`);
}
