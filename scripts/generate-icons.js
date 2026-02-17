/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const combined = Buffer.concat([typeBuffer, data]);
  const crcVal = crc32(combined);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcVal, 0);
  return Buffer.concat([length, combined, crcBuffer]);
}

function createPNG(width, height, pixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
      rawData[offset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Distance from center
function dist(x, y, cx, cy) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

// Icon design: Black bg, gold circle with panda face
function pandaIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.42;
  const d = dist(x, y, cx, cy);

  // Background: pure black
  let R = 0, G = 0, B = 0, A = 255;

  // Gold circle background
  if (d < r) {
    R = 212; G = 175; B = 55; A = 255;

    // Anti-aliasing edge
    if (d > r - 1.5) {
      const alpha = Math.max(0, Math.min(1, (r - d) / 1.5));
      R = Math.round(R * alpha);
      G = Math.round(G * alpha);
      B = Math.round(B * alpha);
    }

    const s = w / 512; // scale factor

    // Panda face (white circle)
    const faceR = 100 * s;
    const faceCy = cy + 10 * s;
    if (dist(x, y, cx, faceCy) < faceR) {
      R = 20; G = 20; B = 20;
    }

    // Panda ears (black circles)
    const earR = 45 * s;
    const earY = cy - 75 * s;
    if (dist(x, y, cx - 70 * s, earY) < earR || dist(x, y, cx + 70 * s, earY) < earR) {
      R = 20; G = 20; B = 20;
    }

    // Eyes (white circles with black pupils)
    const eyeR = 28 * s;
    const eyeY = faceCy - 15 * s;
    const leftEyeX = cx - 35 * s;
    const rightEyeX = cx + 35 * s;

    if (dist(x, y, leftEyeX, eyeY) < eyeR || dist(x, y, rightEyeX, eyeY) < eyeR) {
      R = 245; G = 245; B = 245;
    }

    // Eye patches (dark patches around eyes - panda style)
    const patchR = 35 * s;
    if (dist(x, y, leftEyeX, eyeY) < patchR || dist(x, y, rightEyeX, eyeY) < patchR) {
      R = 30; G = 30; B = 30;
    }

    // Eyes again (white, on top of patches)
    const innerEyeR = 20 * s;
    if (dist(x, y, leftEyeX, eyeY) < innerEyeR || dist(x, y, rightEyeX, eyeY) < innerEyeR) {
      R = 240; G = 240; B = 240;
    }

    // Pupils
    const pupilR = 10 * s;
    if (dist(x, y, leftEyeX, eyeY) < pupilR || dist(x, y, rightEyeX, eyeY) < pupilR) {
      R = 10; G = 10; B = 10;
    }

    // Nose (small black oval)
    const noseR = 12 * s;
    const noseY = faceCy + 15 * s;
    if (dist(x, y, cx, noseY) < noseR) {
      R = 20; G = 20; B = 20;
    }

    // Mouth (simple curve using two small circles)
    const mouthY = faceCy + 30 * s;
    const mouthD1 = dist(x, y, cx - 12 * s, mouthY);
    const mouthD2 = dist(x, y, cx + 12 * s, mouthY);
    if ((mouthD1 > 14 * s && mouthD1 < 17 * s && y > mouthY) ||
        (mouthD2 > 14 * s && mouthD2 < 17 * s && y > mouthY)) {
      R = 20; G = 20; B = 20;
    }

    // Gold shine highlight (top-left of circle)
    const shineD = dist(x, y, cx - r * 0.3, cy - r * 0.3);
    if (shineD < r * 0.15 && d < r * 0.85) {
      const shineAlpha = 1 - shineD / (r * 0.15);
      R = Math.min(255, R + Math.round(40 * shineAlpha));
      G = Math.min(255, G + Math.round(35 * shineAlpha));
      B = Math.min(255, B + Math.round(10 * shineAlpha));
    }
  }

  // Rounded corners for maskable
  const cornerR = w * 0.08;
  if (x < cornerR && y < cornerR && dist(x, y, cornerR, cornerR) > cornerR) A = 0;
  if (x > w - cornerR && y < cornerR && dist(x, y, w - cornerR, cornerR) > cornerR) A = 0;
  if (x < cornerR && y > h - cornerR && dist(x, y, cornerR, h - cornerR) > cornerR) A = 0;
  if (x > w - cornerR && y > h - cornerR && dist(x, y, w - cornerR, h - cornerR) > cornerR) A = 0;

  return [R, G, B, A];
}

// Generate icons
const publicDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512];
sizes.forEach(size => {
  const png = createPNG(size, size, pandaIcon);
  const filePath = path.join(publicDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: icon-${size}x${size}.png (${png.length} bytes)`);
});

// Apple touch icon (180x180)
const applePng = createPNG(180, 180, pandaIcon);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), applePng);
console.log(`Generated: apple-touch-icon.png (${applePng.length} bytes)`);

// Favicon (32x32)
const faviconPng = createPNG(32, 32, pandaIcon);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), faviconPng);
console.log(`Generated: favicon.png (${faviconPng.length} bytes)`);

console.log('\nAll icons generated successfully!');
