import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const svgBuf = fs.readFileSync(path.join(root, 'public/favicon.svg'))
const iconsDir = path.join(root, 'public/icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir)

const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-maskable-192x192.png', size: 192 },
  { name: 'icon-maskable-512x512.png', size: 512 },
]

await Promise.all(sizes.map(({ name, size }) =>
  sharp(svgBuf)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, name))
    .then(() => console.log('Generated:', name))
))

console.log('All PWA icons generated successfully.')
