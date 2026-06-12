/**
 * Share-imagery generator (design §11 Phase 6) — zero dependencies.
 *
 * Renders the ORBE social card (1200×630 `public/og.png`) and the iOS home
 * screen icon (180×180 `public/apple-touch-icon.png`) with per-pixel math —
 * a shaded sphere matching the page's lighting story (warm key upper-left,
 * cool rim right, machined ring, accent LED) plus an SDF-stroked wordmark —
 * and encodes PNGs by hand (IHDR/IDAT/IEND + node:zlib deflate).
 *
 * Run: bun run assets:og   (idempotent; commit the outputs)
 *
 * Why procedural: the hero itself is procedural (no artist asset exists,
 * see PHASE_2_HANDOFF). When a real render lands, replace the outputs and
 * delete this script.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/* ---------------------------------------------------------------- *
 * Tokens (mirror src/styles/tokens.css)                             *
 * ---------------------------------------------------------------- */
const BG = [11 / 255, 11 / 255, 12 / 255];
const INK = [244 / 255, 242 / 255, 238 / 255];
const ACCENT = [232 / 255, 96 / 255, 44 / 255];

/* ---------------------------------------------------------------- *
 * Small math kit                                                    *
 * ---------------------------------------------------------------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0, e1, v) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function arcDist(px, py, cx, cy, r, a0, a1) {
  const dx = px - cx;
  const dy = py - cy;
  const ang = Math.atan2(dy, dx);
  if (ang >= a0 && ang <= a1) {
    return Math.abs(Math.hypot(dx, dy) - r);
  }
  const e0x = cx + r * Math.cos(a0);
  const e0y = cy + r * Math.sin(a0);
  const e1x = cx + r * Math.cos(a1);
  const e1y = cy + r * Math.sin(a1);
  return Math.min(Math.hypot(px - e0x, py - e0y), Math.hypot(px - e1x, py - e1y));
}

/* ---------------------------------------------------------------- *
 * The ORBE sphere — same light story as stage/Lighting.tsx          *
 * ---------------------------------------------------------------- */
const KEY = normalize3(-0.5, -0.6, 0.62); // warm key, upper-left (screen y down)
const HALF = normalize3(KEY[0], KEY[1], KEY[2] + 1); // toward the viewer

/** Returns [r, g, b, coverage] for a sphere centered (cx, cy) radius r. */
function shadeSphere(px, py, cx, cy, radius) {
  const dx = (px - cx) / radius;
  const dy = (py - cy) / radius;
  const d2 = dx * dx + dy * dy;
  const dist = Math.sqrt(d2) * radius;
  const coverage = 1 - smoothstep(radius - 1.5, radius + 1.5, dist);
  if (coverage <= 0) {
    return [0, 0, 0, 0];
  }
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
  const ndl = Math.max(0, dx * KEY[0] + dy * KEY[1] + nz * KEY[2]);
  const ndh = Math.max(0, dx * HALF[0] + dy * HALF[1] + nz * HALF[2]);

  // machined volume ring: a brighter latitude band with groove edges
  const band =
    smoothstep(-0.44, -0.4, dy) * (1 - smoothstep(-0.3, -0.26, dy));
  const groove =
    Math.exp(-((dy + 0.43) ** 2) / 0.00014) +
    Math.exp(-((dy + 0.27) ** 2) / 0.00014);

  const ambient = 0.16 + 0.1 * nz;
  const diffuse = ndl ** 1.2 * (1 + 0.35 * band);
  const rim = Math.max(0, dx) ** 2 * (1 - nz) ** 1.2;
  const spec = ndh ** 70 * (0.9 + 0.5 * band);

  let r = 0.15 * ambient + 1.0 * diffuse * 0.52 + rim * 0.45 * 0.55 + spec;
  let g = 0.15 * ambient + 0.8 * diffuse * 0.52 + rim * 0.58 * 0.55 + spec * 0.95;
  let b = 0.16 * ambient + 0.62 * diffuse * 0.52 + rim * 0.82 * 0.55 + spec * 0.88;
  const shade = 1 - 0.45 * Math.min(1, groove);
  return [r * shade, g * shade, b * shade, coverage];
}

/* ---------------------------------------------------------------- *
 * Wordmark "ORBE" as stroke SDFs (geometric grotesk, circular O)    *
 * ---------------------------------------------------------------- */
const Y0 = 250;
const Y1 = 380;
const SW = 7; // stroke half-width (14 px strokes on a 130 px cap height)

function buildWordmark() {
  const strokes = [];
  const seg = (ax, ay, bx, by) => strokes.push({ kind: 'seg', ax, ay, bx, by });
  const arc = (cx, cy, r, a0, a1) => strokes.push({ kind: 'arc', cx, cy, r, a0, a1 });
  const HALF_PI = Math.PI / 2;
  let x = 130;
  // O — a perfect circle (it is an orb, after all)
  arc(x + 65, (Y0 + Y1) / 2, 58, -Math.PI, Math.PI);
  x += 164;
  // R — stem, semicircular bowl, diagonal leg
  seg(x + SW, Y0 + SW, x + SW, Y1 - SW);
  arc(x + SW, Y0 + 42, 42, -HALF_PI, HALF_PI);
  seg(x + 17, Y0 + 84, x + 73, Y1 - SW);
  x += 114;
  // B — stem, two semicircular bowls
  seg(x + SW, Y0 + SW, x + SW, Y1 - SW);
  arc(x + SW, Y0 + 31, 31, -HALF_PI, HALF_PI);
  arc(x + SW, Y0 + 96, 34, -HALF_PI, HALF_PI);
  x += 114;
  // E — stem, three bars
  seg(x + SW, Y0 + SW, x + SW, Y1 - SW);
  seg(x + SW, Y0 + SW, x + 66, Y0 + SW);
  seg(x + SW, Y0 + 62, x + 56, Y0 + 62);
  seg(x + SW, Y1 - SW, x + 66, Y1 - SW);
  return { strokes, dotX: x + 92, dotY: Y1 - 9 };
}

const WORDMARK = buildWordmark();

function wordmarkAlpha(px, py) {
  if (px < 100 || px > 660 || py < 230 || py > 400) {
    return 0;
  }
  let d = Infinity;
  for (const s of WORDMARK.strokes) {
    d = Math.min(
      d,
      s.kind === 'seg'
        ? segDist(px, py, s.ax, s.ay, s.bx, s.by)
        : arcDist(px, py, s.cx, s.cy, s.r, s.a0, s.a1),
    );
    if (d <= 0) break;
  }
  return 1 - smoothstep(SW - 0.9, SW + 0.9, d);
}

function accentDotAlpha(px, py) {
  const d = Math.hypot(px - WORDMARK.dotX, py - WORDMARK.dotY);
  return 1 - smoothstep(8.1, 9.9, d);
}

/* ---------------------------------------------------------------- *
 * Scenes                                                            *
 * ---------------------------------------------------------------- */
function renderCard(width, height) {
  const cx = 880;
  const cy = 300;
  const radius = 200;
  const ledX = cx + 0.12 * radius;
  const ledY = cy + 0.4 * radius;
  const out = new Uint8Array(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // backdrop + ambient glow behind the object
      const glow = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 430 ** 2);
      let r = BG[0] + 0.063 * glow;
      let g = BG[1] + 0.051 * glow;
      let b = BG[2] + 0.043 * glow;

      // bounce light grounding the sphere
      const fx = (x - cx) / 280;
      const fy = (y - 560) / 40;
      const floor = Math.exp(-(fx * fx + fy * fy));
      r += 0.1 * floor;
      g += 0.086 * floor;
      b += 0.07 * floor;

      // the object
      const [sr, sg, sb, sa] = shadeSphere(x, y, cx, cy, radius);
      r = mix(r, sr, sa);
      g = mix(g, sg, sa);
      b = mix(b, sb, sa);

      // status LED + halo (the page's only emissive)
      const ledD2 = (x - ledX) ** 2 + (y - ledY) ** 2;
      const led = 1.6 * Math.exp(-ledD2 / 7 ** 2) + 0.5 * Math.exp(-ledD2 / 26 ** 2);
      r += ACCENT[0] * led;
      g += ACCENT[1] * led;
      b += ACCENT[2] * led;

      // wordmark + accent full stop
      const ink = wordmarkAlpha(x, y);
      if (ink > 0) {
        r = mix(r, INK[0], ink);
        g = mix(g, INK[1], ink);
        b = mix(b, INK[2], ink);
      }
      const dot = accentDotAlpha(x, y);
      if (dot > 0) {
        r = mix(r, ACCENT[0], dot);
        g = mix(g, ACCENT[1], dot);
        b = mix(b, ACCENT[2], dot);
      }

      // vignette
      const nd = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2)) / Math.SQRT2;
      const vig = 1 - 0.38 * smoothstep(0.55, 1.05, nd);

      const i = (y * width + x) * 3;
      out[i] = Math.round(clamp01(r * vig) * 255);
      out[i + 1] = Math.round(clamp01(g * vig) * 255);
      out[i + 2] = Math.round(clamp01(b * vig) * 255);
    }
  }
  return out;
}

function renderIcon(size) {
  const cx = size / 2;
  const cy = size * 0.46;
  const radius = size * 0.31;
  const ledX = cx + 0.12 * radius;
  const ledY = cy + 0.4 * radius;
  const out = new Uint8Array(size * size * 3);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const glow = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (size * 0.55) ** 2);
      let r = BG[0] + 0.055 * glow;
      let g = BG[1] + 0.045 * glow;
      let b = BG[2] + 0.038 * glow;

      const [sr, sg, sb, sa] = shadeSphere(x, y, cx, cy, radius);
      r = mix(r, sr, sa);
      g = mix(g, sg, sa);
      b = mix(b, sb, sa);

      const ledD2 = (x - ledX) ** 2 + (y - ledY) ** 2;
      const led =
        1.6 * Math.exp(-ledD2 / (radius * 0.045) ** 2) +
        0.5 * Math.exp(-ledD2 / (radius * 0.16) ** 2);
      r += ACCENT[0] * led;
      g += ACCENT[1] * led;
      b += ACCENT[2] * led;

      const i = (y * size + x) * 3;
      out[i] = Math.round(clamp01(r) * 255);
      out[i + 1] = Math.round(clamp01(g) * 255);
      out[i + 2] = Math.round(clamp01(b) * 255);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * Minimal PNG encoder (8-bit RGB, "Up" filter, zlib level 9)        *
 * ---------------------------------------------------------------- */
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(pixels, width, height) {
  const stride = width * 3;
  // "Up" filter per row: smooth vertical gradients deflate far better raw.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOff = y * (stride + 1);
    raw[rowOff] = 2;
    for (let i = 0; i < stride; i += 1) {
      const cur = pixels[y * stride + i];
      const above = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      raw[rowOff + 1 + i] = (cur - above) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- */
const card = encodePng(renderCard(1200, 630), 1200, 630);
writeFileSync('public/og.png', card);
console.log(`public/og.png            1200×630  ${(card.length / 1024).toFixed(1)} KB`);

const icon = encodePng(renderIcon(180), 180, 180);
writeFileSync('public/apple-touch-icon.png', icon);
console.log(`public/apple-touch-icon.png  180×180  ${(icon.length / 1024).toFixed(1)} KB`);
