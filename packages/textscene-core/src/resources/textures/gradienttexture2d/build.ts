/**
 * Rasterise a decoded `GradientTexture2D` into a `THREE.DataTexture`.
 *
 * The slice's THREE-touching half: `decode.ts` reads the resource body,
 * `sample.ts` evaluates it per pixel, and this file is the only place a
 * gradient becomes a GPU texture — so a material's
 * `albedo_texture = SubResource(GradientTexture2D)` samples the same pixels
 * Godot's does.
 *
 * PARITY LIMITATION — `use_hdr`: we always emit RGBA8. An HDR gradient
 * (channels > 1) would clamp; no shipped scene uses HDR gradients.
 */

import * as THREE from 'three';
import { gradientOffsetAt, sampleGradientColor } from './sample';
import type { Gradient, GradientTexture2D } from './types';

/**
 * Rasterise the gradient into an RGBA8 `THREE.DataTexture` sized
 * `tex.width × tex.height`. Bytes are the sRGB-space channels rounded to 8 bit
 * (Godot's `Color::get_r8()`), so the texture is tagged `SRGBColorSpace` — the
 * renderer decodes it to linear on sample exactly as Godot decodes an albedo
 * texture. Alpha is not colour-managed and passes through linearly.
 *
 * `LinearFilter` (not DataTexture's `NearestFilter` default) matches Godot's
 * smooth sampling — a 64×64 gradient stretched over a quad must not read blocky.
 */
export function rasterizeGradientTexture2D(
  tex: GradientTexture2D,
  gradient: Gradient
): THREE.DataTexture {
  const width = Math.max(1, Math.floor(tex.width));
  const height = Math.max(1, Math.floor(tex.height));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = gradientOffsetAt(tex, x, y);
      const color = sampleGradientColor(gradient, offset);
      // Written BOTTOM-UP. A DataTexture is uploaded from a typed array, and
      // WebGL's UNPACK_FLIP_Y only applies to image/canvas/video sources — so
      // `flipY` cannot fix this at the texture level. Every 2D UV path in the
      // repo is written for the flipY=true convention a file-backed texture
      // gets (polygon2d emits `1 - godot_v`; the light cookie passes
      // planeGeometry's uv straight through), so Godot's TOP row has to land at
      // v = 1, which is the last row of the buffer. Left top-down, a linear
      // gradient sampled here renders upside-down against the same gradient
      // shipped as a PNG.
      const i = (x + (height - 1 - y) * width) * 4;
      data[i] = to8(color.r);
      data[i + 1] = to8(color.g);
      data[i + 2] = to8(color.b);
      data[i + 3] = to8(color.a);
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Godot's `Color::get_r8()`: round to 8-bit, clamped to 0..255. */
function to8(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel * 255)));
}
