/**
 * Turning a directory of captured PNG frames into the GIF the gallery plays.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { GIFEncoder, applyPalette, quantize } from '../vendor/gifenc.mjs';
import { FPS } from './clip.mjs';

/**
 * Crop every captured frame in place to a window. A 2D animation renders at the
 * full project-viewport size (positions are absolute); the GIF only needs the
 * region around the sprite, and cropping keeps it small.
 */
export async function cropFrames(framesDir, { x, y, w, h }) {
  const files = (await readdir(framesDir)).filter((f) => /^frame_\d+\.png$/.test(f));
  for (const f of files) {
    const src = PNG.sync.read(readFileSync(join(framesDir, f)));
    const cw = Math.min(w, src.width - x);
    const ch = Math.min(h, src.height - y);
    const dst = new PNG({ width: cw, height: ch });
    PNG.bitblt(src, dst, x, y, cw, ch, 0, 0);
    writeFileSync(join(framesDir, f), PNG.sync.write(dst));
  }
}

export async function encodeGif(framesDir, outPath) {
  const files = (await readdir(framesDir))
    .filter((f) => /^frame_\d+\.png$/.test(f))
    .sort();
  const gif = GIFEncoder();
  for (const f of files) {
    const png = PNG.sync.read(readFileSync(join(framesDir, f)));
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, png.width, png.height, { palette, delay: Math.round(1000 / FPS) });
  }
  gif.finish();
  writeFileSync(outPath, Buffer.from(gif.bytes()));
}
