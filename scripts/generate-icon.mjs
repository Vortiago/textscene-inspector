#!/usr/bin/env node
/**
 * Generates apps/textscene-vscode/icon.png (256x256) procedurally.
 *
 * Dependency-free: rasterizes into an RGBA buffer and writes the PNG by hand
 * (chunk layout + CRC32), compressing scanlines with node:zlib deflateSync.
 *
 * Design: dark rounded-square background with an isometric wireframe cube —
 * in isometric projection a cube reads as a hexagon with six spokes meeting
 * at the center, echoing the 3D-scene-preview purpose of the extension.
 *
 * Usage: node scripts/generate-icon.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/textscene-vscode/icon.png'
);

// Palette
const BG = [0x1e, 0x1e, 0x2e]; // dark background (#1e1e2e)
const EDGE = [0x7a, 0xa2, 0xf7]; // cube edges (#7aa2f7)
const DOT = [0xbb, 0x9a, 0xf7]; // vertex dots (#bb9af7)

// ---------------------------------------------------------------------------
// Rasterization
// ---------------------------------------------------------------------------

/** RGBA pixel buffer, initialized fully transparent. */
const pixels = new Uint8Array(SIZE * SIZE * 4);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Source-over composite of (r,g,b,alpha) onto the pixel at (x,y). */
function blend(x, y, [r, g, b], alpha) {
  if (alpha <= 0) return;
  const i = (y * SIZE + x) * 4;
  const dstA = pixels[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA === 0) return;
  pixels[i] = Math.round((r * alpha + pixels[i] * dstA * (1 - alpha)) / outA);
  pixels[i + 1] = Math.round((g * alpha + pixels[i + 1] * dstA * (1 - alpha)) / outA);
  pixels[i + 2] = Math.round((b * alpha + pixels[i + 2] * dstA * (1 - alpha)) / outA);
  pixels[i + 3] = Math.round(outA * 255);
}

/** Signed distance from point to a rounded square centered in the canvas. */
function roundedSquareDistance(px, py, half, radius) {
  const qx = Math.abs(px - SIZE / 2) - (half - radius);
  const qy = Math.abs(py - SIZE / 2) - (half - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance from point to a line segment. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

// Isometric cube geometry: project unit-cube vertices (x,y,z in {0,1}).
// Screen Y grows downward, so +z maps to "up" by subtraction.
const CUBE_SCALE = 56;
const CX = 128;
const CY = 130;
const COS30 = Math.sqrt(3) / 2;

function project(x, y, z) {
  return [
    CX + (x - y) * COS30 * CUBE_SCALE,
    CY + (x + y) * 0.5 * CUBE_SCALE - z * CUBE_SCALE,
  ];
}

const vertices = [];
for (let x = 0; x <= 1; x++) {
  for (let y = 0; y <= 1; y++) {
    for (let z = 0; z <= 1; z++) {
      vertices.push({ coords: [x, y, z], screen: project(x, y, z) });
    }
  }
}

// The 12 cube edges: vertex pairs differing in exactly one coordinate.
const edges = [];
for (let i = 0; i < vertices.length; i++) {
  for (let j = i + 1; j < vertices.length; j++) {
    const [a, b] = [vertices[i].coords, vertices[j].coords];
    const diff = a.filter((v, k) => v !== b[k]).length;
    if (diff === 1) {
      edges.push([vertices[i].screen, vertices[j].screen]);
    }
  }
}

// Deduplicate vertex dot positions: (0,0,0) and (1,1,1) project to the same
// screen point in isometric view.
const dotCenters = [];
for (const { screen } of vertices) {
  if (!dotCenters.some(([x, y]) => Math.hypot(x - screen[0], y - screen[1]) < 1)) {
    dotCenters.push(screen);
  }
}

const BG_HALF = 122; // background half-extent (12px margin to canvas edge)
const BG_RADIUS = 52; // corner radius
const LINE_HALF_WIDTH = 1.5; // 3px-wide edges
const DOT_RADIUS = 7;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;

    // Layer 1: rounded-square background (1px anti-aliased rim).
    const bgAlpha = clamp01(0.5 - roundedSquareDistance(px, py, BG_HALF, BG_RADIUS));
    blend(x, y, BG, bgAlpha);

    // Layer 2: cube edges.
    let edgeDist = Infinity;
    for (const [[ax, ay], [bx, by]] of edges) {
      const d = segmentDistance(px, py, ax, ay, bx, by);
      if (d < edgeDist) edgeDist = d;
    }
    blend(x, y, EDGE, clamp01(LINE_HALF_WIDTH + 0.5 - edgeDist) * bgAlpha);

    // Layer 3: vertex dots on top.
    let dotDist = Infinity;
    for (const [dx, dy] of dotCenters) {
      const d = Math.hypot(px - dx, py - dy);
      if (d < dotDist) dotDist = d;
    }
    blend(x, y, DOT, clamp01(DOT_RADIUS + 0.5 - dotDist) * bgAlpha);
  }
}

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); // width
ihdr.writeUInt32BE(SIZE, 4); // height
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Scanlines: filter byte 0 (None) + raw RGBA per row.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0;
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, rowStart + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, png);
console.log(`Wrote ${OUT_PATH} (${png.length} bytes, ${SIZE}x${SIZE} RGBA)`);
