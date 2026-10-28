import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('public/icons', { recursive: true });
const icon = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="#40335B"/>
<circle cx="256" cy="256" r="171" fill="#8B7BC8" opacity=".24"/>
<g fill="none" stroke="#FAF8F5" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">
<path d="M256 351V247c0-58 28-96 81-96h22v26c0 55-38 86-103 86"/>
<path d="M256 298c0-60-30-93-82-93h-21v23c0 48 35 75 103 75"/>
<path d="M204 356h104"/></g></svg>`;
for (const size of [192, 512]) {
  await sharp(Buffer.from(icon(false))).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  await sharp(Buffer.from(icon(true))).resize(size, size).png().toFile(`public/icons/maskable-${size}.png`);
}
await sharp(Buffer.from(icon(true))).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
