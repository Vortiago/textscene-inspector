/**
 * Rasterises a decoded `GradientTexture2D` into a `THREE.DataTexture`: the only place a gradient
 * becomes a GPU texture.
 */

import type * as THREE from 'three';
import { channelToByte } from '../../../utils/colorSpace';
import { colourDataTexture } from '../colourDataTexture';
import { gradientOffsetAt, sampleGradientColor } from './sample';
import type { Gradient, GradientTexture2D } from './types';

/**
 * A texture of `tex.width × tex.height` texels, as `GradientTexture2D::_update` fills its image
 * (`scene/resources/gradient_texture.cpp:239-270`): RGBA8 bytes from `Color::get_r8()`, or the raw
 * float colour with `use_hdr`, so a channel past 1 survives. `decodeGradientTexture2D` bounds both
 * axes to what Godot's size setters accept, 16384 each, and `resolveGradientTexture` draws no
 * texture where the tab cannot allocate that much.
 */
export function rasterizeGradientTexture2D(tex: GradientTexture2D, gradient: Gradient): THREE.DataTexture {
  const { width, height } = tex;
  const texelCount = width * height * 4;
  const data = tex.useHdr ? new Float32Array(texelCount) : new Uint8Array(texelCount);
  const store = tex.useHdr ? Math.fround : channelToByte;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = gradientOffsetAt(tex, x, y);
      const color = sampleGradientColor(gradient, offset);
      // Written bottom-up: UNPACK_FLIP_Y skips a typed array, and every 2D UV path
      // assumes a file texture's flipY=true layout (polygon2d emits `1 - godot_v`).
      // So Godot's top row lands at v = 1, the buffer's last row.
      const i = (x + (height - 1 - y) * width) * 4;
      data[i] = store(color.r);
      data[i + 1] = store(color.g);
      data[i + 2] = store(color.b);
      data[i + 3] = store(color.a);
    }
  }
  return colourDataTexture(data, width, height);
}
