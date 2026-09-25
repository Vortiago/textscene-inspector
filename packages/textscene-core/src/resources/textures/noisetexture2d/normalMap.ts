/**
 * `Image::bump_map_to_normal_map`: the last stage of the NoiseTexture2D pipeline,
 * run when `as_normal_map` is set.
 */

import { clamp8 } from './noiseBytes';

/**
 * `Image::bump_map_to_normal_map` (core/io/image.cpp:4083-4128). Godot keeps only
 * red (`FORMAT_RF`), so a ramped height field is the ramp's red. Neighbours wrap,
 * and the normal is `across x up`, packed as `127.5 + n * 127.5`.
 *
 * @param stride Where red sits: 4 for RGBA, 1 for raw grayscale with no ramp.
 */
export function bumpMapToNormalMap(
  heights: Uint8Array,
  stride: number,
  width: number,
  height: number,
  bumpScale: number
): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const red = (x: number, y: number): number => heights[(y * width + x) * stride]! / 255;

  for (let ty = 0; ty < height; ty++) {
    let py = ty + 1;
    if (py >= height) py -= height;
    for (let tx = 0; tx < width; tx++) {
      let px = tx + 1;
      if (px >= width) px -= width;

      const here = red(tx, ty);
      const toRight = red(px, ty);
      const above = red(tx, py);
      // up = (0, 1, (here - above) * scale) and across = (1, 0, (toRight - here)
      // * scale), whose cross product `across x up` reduces to (-acrossZ, -upZ, 1).
      const upZ = (here - above) * bumpScale;
      const acrossZ = (toRight - here) * bumpScale;
      let nx = -acrossZ;
      let ny = -upZ;
      let nz = 1;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;

      const i = (ty * width + tx) << 2;
      out[i] = clamp8(127.5 + nx * 127.5);
      out[i + 1] = clamp8(127.5 + ny * 127.5);
      out[i + 2] = clamp8(127.5 + nz * 127.5);
      out[i + 3] = 255;
    }
  }
  return out;
}
