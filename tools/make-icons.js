/* توليد أيقونات التطبيق (PNG) بلا اعتماديات خارجية.
   التشغيل: node tools/make-icons.js   ← يكتب icons/icon-512.png و icons/icon-180.png */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [18, 58, 99];
const WHITE = [255, 255, 255];

function draw(size) {
  const px = new Uint8Array(size * size * 3);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  };

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) set(x, y, NAVY);

  const t = Math.max(2, Math.round(size * 0.02));   /* سماكة الخطّ */
  const m = Math.round(size * 0.19);                /* هامش المستطيل */
  const w = size - m * 2;
  const h = Math.round(w * 0.66);
  const top = Math.round((size - h) / 2);

  /* إطار الملعب */
  for (let i = 0; i < t; i++) {
    for (let x = m; x < m + w; x++) { set(x, top + i, WHITE); set(x, top + h - 1 - i, WHITE); }
    for (let y = top; y < top + h; y++) { set(m + i, y, WHITE); set(m + w - 1 - i, y, WHITE); }
  }

  /* خطّ المنتصف */
  const cx = Math.round(size / 2), cy = Math.round(top + h / 2);
  for (let i = 0; i < t; i++)
    for (let y = top; y < top + h; y++) set(cx - Math.floor(t / 2) + i, y, WHITE);

  /* دائرة المنتصف */
  const r = Math.round(h * 0.22);
  for (let a = 0; a < 3600; a++) {
    const rad = a * Math.PI / 1800;
    for (let i = 0; i < t; i++) {
      set(Math.round(cx + (r + i) * Math.cos(rad)), Math.round(cy + (r + i) * Math.sin(rad)), WHITE);
    }
  }

  return px;
}

function png(size, px) {
  /* بيانات الخام مع بايت المرشّح لكلّ سطر */
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1);
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    /* عمق البِت */
  ihdr[9] = 2;    /* RGB */

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
[512, 192, 180].forEach(size => {
  const file = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, draw(size)));
  console.log('كُتب:', file);
});
