/**
 * `Noise::_get_image` and `_get_seamless_image` — the grayscale field, one byte
 * per pixel, in Godot's own layout.
 *
 * This is the layer around the vendored generator that IS Godot's: the
 * normalization rule and the seamless blend skirt.
 */

import { smoothstep } from '../../../godot/math.js';
import { alphaBlend, clamp8 } from './noiseBytes';
import type { NoiseSampler } from './noiseGenerator';

/**
 * `Noise::_get_image` (noise.cpp:81-163) — the grayscale field as one byte per
 * pixel, row 0 at the top.
 *
 * With `normalize` (Godot's default) the whole image is sampled first so the
 * values can be rescaled to their own min/max; a flat field (max == min) writes
 * zeroes rather than dividing by zero. Without it the raw -1..1 range maps
 * through `value * 127.5 + 127.5`.
 */
export function noiseImage(
  sample: NoiseSampler,
  width: number,
  height: number,
  invert: boolean,
  normalize: boolean
): Uint8Array {
  const out = new Uint8Array(width * height);

  if (normalize) {
    const values = new Float32Array(width * height);
    let min = Infinity;
    let max = -Infinity;
    let i = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        values[i] = sample(x, y);
        // Compare the STORED value, not the double that produced it: Godot's
        // buffer is `real_t` (float) and its min/max come from the same array,
        // so tracking the wider value here would leave the brightest pixel
        // fractionally below 1.0 of the span and truncate to 254, not 255.
        const stored = values[i]!;
        if (stored > max) max = stored;
        if (stored < min) min = stored;
        i++;
      }
    }
    const span = max - min;
    for (let idx = 0; idx < values.length; idx++) {
      const value = span === 0 ? 0 : clamp8(((values[idx]! - min) / span) * 255);
      out[idx] = invert ? 255 - value : value;
    }
    return out;
  }

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = clamp8(sample(x, y) * 127.5 + 127.5);
      out[idx++] = invert ? 255 - value : value;
    }
  }
  return out;
}

/**
 * `Noise::_get_seamless_image` + `_generate_seamless_image`
 * (noise.cpp:33-51, noise.h:84-200) for the grayscale case.
 *
 * The trick is Godot's: generate an image a skirt larger, swap its quadrants so
 * opposite edges meet, then blend the skirt back over the two seams with a
 * smoothstep alpha. Every index below is the `img_buff` indexer's arithmetic
 * with the same modulo variants, and the blend is the `uint8_t` specialisation
 * of `_alpha_blend` (noise.h:73-79).
 */
export function seamlessNoiseImage(
  sample: NoiseSampler,
  width: number,
  height: number,
  invert: boolean,
  normalize: boolean,
  blendSkirt: number
): Uint8Array {
  const skirtWidth = Math.max(1, Math.trunc(width * blendSkirt));
  const skirtHeight = Math.max(1, Math.trunc(height * blendSkirt));
  const srcWidth = width + skirtWidth;
  const srcHeight = height + skirtHeight;
  const src = noiseImage(sample, srcWidth, srcHeight, invert, normalize);

  const halfWidth = Math.trunc(width * 0.5);
  const halfHeight = Math.trunc(height * 0.5);
  const skirtEdgeX = halfWidth + skirtWidth;
  const skirtEdgeY = halfHeight + skirtHeight;

  // `img_buff::operator()` over the source: offsets by half a tile, and each
  // mode picks which axis wraps on the OUTPUT size instead of the source size.
  const rdSrc = (x: number, y: number, mode: 'default' | 'altX' | 'altY' | 'altXY'): number => {
    const px = x + halfWidth;
    const py = y + halfHeight;
    const cx = mode === 'altX' || mode === 'altXY' ? px % width : px % srcWidth;
    const cy = mode === 'altY' || mode === 'altXY' ? py % height : py % srcHeight;
    return src[cx + cy * srcWidth]!;
  };

  const dest = new Uint8Array(width * height);

  // `wr`/`rd_dest` are `img_buff`s over the OUTPUT with no offset, so both wrap
  // on the output size (noise.h:66-67). Past a 0.5 skirt the blend loops run x
  // to `skirtEdgeX` and y to `skirtEdgeY`, beyond the image, and the modulo is
  // what carries those writes back onto the opposite edge. Indexing raw instead
  // dropped them — a silent no-op on a Uint8Array — leaving three quarters of
  // the pixels unblended at `seamless_blend_skirt = 1`.
  const at = (x: number, y: number): number => (x % width) + (y % height) * width;

  // Swap the quadrants so the edges are perfect matches.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      dest[at(x, y)] = rdSrc(x, y, 'altXY');
    }
  }

  // Blend the vertical skirt over the middle seam.
  for (let x = halfWidth; x < skirtEdgeX; x++) {
    const alpha = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (x - halfWidth) / skirtWidth)));
    for (let y = 0; y < height; y++) {
      // Skip the centre square — the fourth pass fills it.
      if (y === halfHeight) {
        y = skirtEdgeY - 1;
        continue;
      }
      dest[at(x, y)] = alphaBlend(dest[at(x, y)]!, rdSrc(x, y, 'altY'), alpha);
    }
  }

  // Blend the horizontal skirt over the middle seam.
  for (let y = halfHeight; y < skirtEdgeY; y++) {
    const alpha = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (y - halfHeight) / skirtHeight)));
    for (let x = 0; x < width; x++) {
      if (x === halfWidth) {
        x = skirtEdgeX - 1;
        continue;
      }
      dest[at(x, y)] = alphaBlend(dest[at(x, y)]!, rdSrc(x, y, 'altX'), alpha);
    }
  }

  // Fill in the centre square, where both skirts overlap.
  for (let y = halfHeight; y < skirtEdgeY; y++) {
    for (let x = halfWidth; x < skirtEdgeX; x++) {
      const xpos = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (x - halfWidth) / skirtWidth)));
      const ypos = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (y - halfHeight) / skirtHeight)));
      const topBlend = alphaBlend(rdSrc(x, y, 'altX'), rdSrc(x, y, 'default'), xpos);
      const bottomBlend = alphaBlend(rdSrc(x, y, 'altXY'), rdSrc(x, y, 'altY'), xpos);
      dest[at(x, y)] = alphaBlend(bottomBlend, topBlend, ypos);
    }
  }

  return dest;
}
