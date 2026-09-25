/**
 * Rasterises a decoded `GradientTexture2D` into a `THREE.DataTexture`: the only
 * place a gradient becomes a GPU texture. Parity limitation: `use_hdr` is
 * ignored and the output is always RGBA8, so an HDR gradient clamps.
 */

import * as THREE from 'three';
import { channelToByte } from '../../../utils/colorSpace';
import { gradientOffsetAt, sampleGradientColor } from './sample';
import type { Gradient, GradientTexture2D } from './types';

/**
 * An RGBA8 texture of `tex.width × tex.height` sRGB bytes (Godot's
 * `Color::get_r8()`), tagged `SRGBColorSpace` like an albedo texture. Alpha passes
 * through linearly. `LinearFilter`, not DataTexture's `NearestFilter`, matches
 * Godot's smooth sampling. `decodeGradientTexture2D` bounds both axes to what
 * Godot's size setters accept, so the allocation stays within 16384².
 */
export function rasterizeGradientTexture2D(
  tex: GradientTexture2D,
  gradient: Gradient
): THREE.DataTexture {
  const { width, height } = tex;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = gradientOffsetAt(tex, x, y);
      const color = sampleGradientColor(gradient, offset);
      // Written bottom-up: UNPACK_FLIP_Y skips a typed array, and every 2D UV path
      // assumes a file texture's flipY=true layout (polygon2d emits `1 - godot_v`).
      // So Godot's top row lands at v = 1, the buffer's last row.
      const i = (x + (height - 1 - y) * width) * 4;
      data[i] = channelToByte(color.r);
      data[i + 1] = channelToByte(color.g);
      data[i + 2] = channelToByte(color.b);
      data[i + 3] = channelToByte(color.a);
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
