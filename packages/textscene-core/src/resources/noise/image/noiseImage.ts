/**
 * `Noise::_get_image` and `_get_seamless_image`: the grayscale field, one byte per
 * pixel, or per texel of a volume, in Godot's layout, with Godot's normalization and seamless blend skirt.
 */

import { smoothstep } from '../../../godot/math.js';
import { alphaBlend, clamp8 } from './noiseBytes';
import type { NoiseSampler, NoiseSampler3D } from './noiseSampler';

/**
 * `Noise::_get_image` (noise.cpp:81-163) for one slice, row 0 at the top. With `normalize`, the
 * default, the field rescales to its own min/max, and a flat field writes zeroes. Without it the
 * raw -1..1 range maps through `value * 127.5 + 127.5`.
 */
export function noiseImage(
  sample: NoiseSampler,
  width: number,
  height: number,
  invert: boolean,
  normalize: boolean
): Uint8Array {
  return noiseVolume(sample, width, height, 1, invert, normalize);
}

/**
 * `Noise::_get_image` (noise.cpp:81-163) over `depth` slices, one after another. A normalised
 * volume rescales to the min/max of every slice together.
 */
export function noiseVolume(
  sample: NoiseSampler3D,
  width: number,
  height: number,
  depth: number,
  invert: boolean,
  normalize: boolean
): Uint8Array {
  const out = new Uint8Array(width * height * depth);

  if (normalize) {
    const values = new Float32Array(out.length);
    let min = Infinity;
    let max = -Infinity;
    let i = 0;
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          values[i] = sample(x, y, z);
          // Compare the stored float, not the double: Godot's `real_t` buffer holds
          // its min/max, and the wider value would truncate the brightest to 254.
          const stored = values[i]!;
          if (stored > max) max = stored;
          if (stored < min) min = stored;
          i++;
        }
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
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = clamp8(sample(x, y, z) * 127.5 + 127.5);
        out[idx++] = invert ? 255 - value : value;
      }
    }
  }
  return out;
}

/**
 * How much larger than the output `_get_seamless_image` generates its source on one axis:
 * the blend fraction of the size, at least one pixel (noise.cpp:36-37).
 */
function seamlessSkirt(size: number, blendSkirt: number): number {
  return Math.max(1, Math.trunc(size * blendSkirt));
}

/** The size of `_get_seamless_image`'s source on one axis: the output and its skirt. */
export function seamlessSource(size: number, blendSkirt: number): number {
  return size + seamlessSkirt(size, blendSkirt);
}

/**
 * `Noise::_get_seamless_image` and `_generate_seamless_image` (noise.cpp:33-51,
 * noise.h:84-200), grayscale: generate a skirt larger, swap quadrants, and blend
 * the skirt over both seams with a smoothstep alpha. Indices follow `img_buff`,
 * and the blend is `_alpha_blend<uint8_t>` (noise.h:73-79).
 */
export function seamlessNoiseImage(
  sample: NoiseSampler,
  width: number,
  height: number,
  invert: boolean,
  normalize: boolean,
  blendSkirt: number
): Uint8Array {
  // Godot generates a second source slice for the depth skirt. In 2D both slices hold the same
  // field, so their min/max is one slice's, and the result is the first slice.
  return blendSliceSeams(
    noiseImage(
      sample,
      seamlessSource(width, blendSkirt),
      seamlessSource(height, blendSkirt),
      invert,
      normalize
    ),
    width,
    height,
    blendSkirt
  );
}

/**
 * `_get_seamless_image` and `_generate_seamless_image` over `depth` slices (noise.cpp:33-51,
 * noise.h:84-247): each source slice blends its seams across x and y, then the halves swap in
 * depth and the depth skirt blends over that seam. One slice deep, Godot blends no depth seam and
 * keeps the skirt slice too, so the result holds two slices.
 */
export function seamlessNoiseVolume(
  sample: NoiseSampler3D,
  width: number,
  height: number,
  depth: number,
  invert: boolean,
  normalize: boolean,
  blendSkirt: number
): Uint8Array {
  const srcDepth = seamlessSource(depth, blendSkirt);
  const sliceLength = seamlessSource(width, blendSkirt) * seamlessSource(height, blendSkirt);
  const src = noiseVolume(
    sample,
    seamlessSource(width, blendSkirt),
    seamlessSource(height, blendSkirt),
    srcDepth,
    invert,
    normalize
  );
  const slices = Array.from({ length: srcDepth }, (_, z) =>
    blendSliceSeams(src.subarray(z * sliceLength, (z + 1) * sliceLength), width, height, blendSkirt)
  );
  return concatSlices(depth > 1 ? blendDepthSeam(slices, depth, blendSkirt) : slices);
}

/**
 * The depth pass of `_generate_seamless_image` (noise.h:217-247): swap the halves, then blend the
 * skirt slices over the middle seam. The blend reads the swapped slices, never its own output.
 */
function blendDepthSeam(slices: Uint8Array[], depth: number, blendSkirt: number): Uint8Array[] {
  const skirtDepth = seamlessSkirt(depth, blendSkirt);
  const halfDepth = Math.trunc(depth * 0.5);
  for (let i = 0; i < halfDepth; i++) {
    [slices[i], slices[i + halfDepth]] = [slices[i + halfDepth]!, slices[i]!];
  }
  const out = slices.slice(0, depth);
  for (let z = halfDepth; z < halfDepth + skirtDepth; z++) {
    const alpha = seamAlpha(z - halfDepth, skirtDepth);
    const background = slices[z % depth]!;
    const skirt = slices[z - halfDepth + depth]!;
    out[z % depth] = background.map((value, i) => alphaBlend(value, skirt[i]!, alpha));
  }
  return out;
}

function concatSlices(slices: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(slices.reduce((length, slice) => length + slice.length, 0));
  let offset = 0;
  for (const slice of slices) {
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}

/** The blend weight of the skirt at `step` of `skirt` cells past the seam (noise.h:155, :219). */
function seamAlpha(step: number, skirt: number): number {
  return Math.trunc(255 * (1 - smoothstep(0.1, 0.9, step / skirt)));
}

/**
 * The x and y pass of `_generate_seamless_image` (noise.h:131-200) on one source slice, a skirt
 * larger than the output on each axis: swap quadrants, and blend the skirt over both seams.
 */
function blendSliceSeams(src: Uint8Array, width: number, height: number, blendSkirt: number): Uint8Array {
  const skirtWidth = seamlessSkirt(width, blendSkirt);
  const skirtHeight = seamlessSkirt(height, blendSkirt);
  const srcWidth = seamlessSource(width, blendSkirt);
  const srcHeight = seamlessSource(height, blendSkirt);

  const halfWidth = Math.trunc(width * 0.5);
  const halfHeight = Math.trunc(height * 0.5);
  const skirtEdgeX = halfWidth + skirtWidth;
  const skirtEdgeY = halfHeight + skirtHeight;

  // `img_buff::operator()` over the source: offsets by half a tile, and each mode
  // picks which axis wraps on the output size instead of the source size.
  const rdSrc = (x: number, y: number, mode: 'default' | 'altX' | 'altY' | 'altXY'): number => {
    const px = x + halfWidth;
    const py = y + halfHeight;
    const cx = mode === 'altX' || mode === 'altXY' ? px % width : px % srcWidth;
    const cy = mode === 'altY' || mode === 'altXY' ? py % height : py % srcHeight;
    return src[cx + cy * srcWidth]!;
  };

  const dest = new Uint8Array(width * height);

  // `wr`/`rd_dest` wrap on the output size (noise.h:66-67). Past a 0.5 skirt the
  // loops run to `skirtEdgeX` and `skirtEdgeY`, beyond the image, and the modulo
  // carries those writes onto the opposite edge. A raw index is a silent no-op.
  const at = (x: number, y: number): number => (x % width) + (y % height) * width;

  // Swap the quadrants so the edges are perfect matches.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      dest[at(x, y)] = rdSrc(x, y, 'altXY');
    }
  }

  // Blend the vertical skirt over the middle seam.
  for (let x = halfWidth; x < skirtEdgeX; x++) {
    const alpha = seamAlpha(x - halfWidth, skirtWidth);
    for (let y = 0; y < height; y++) {
      // Skip the centre square: the fourth pass fills it.
      if (y === halfHeight) {
        y = skirtEdgeY - 1;
        continue;
      }
      dest[at(x, y)] = alphaBlend(dest[at(x, y)]!, rdSrc(x, y, 'altY'), alpha);
    }
  }

  // Blend the horizontal skirt over the middle seam.
  for (let y = halfHeight; y < skirtEdgeY; y++) {
    const alpha = seamAlpha(y - halfHeight, skirtHeight);
    for (let x = 0; x < width; x++) {
      if (x === halfWidth) {
        x = skirtEdgeX - 1;
        continue;
      }
      dest[at(x, y)] = alphaBlend(dest[at(x, y)]!, rdSrc(x, y, 'altX'), alpha);
    }
  }

  // Fill the centre square, where both skirts overlap. Each alpha depends on one
  // axis, so both are hoisted: `skirtWidth + skirtHeight` smoothstep calls, not two
  // per pixel.
  const xAlpha = new Uint8Array(skirtEdgeX - halfWidth);
  for (let x = halfWidth; x < skirtEdgeX; x++) {
    xAlpha[x - halfWidth] = seamAlpha(x - halfWidth, skirtWidth);
  }
  for (let y = halfHeight; y < skirtEdgeY; y++) {
    const ypos = seamAlpha(y - halfHeight, skirtHeight);
    for (let x = halfWidth; x < skirtEdgeX; x++) {
      const xpos = xAlpha[x - halfWidth]!;
      const topBlend = alphaBlend(rdSrc(x, y, 'altX'), rdSrc(x, y, 'default'), xpos);
      const bottomBlend = alphaBlend(rdSrc(x, y, 'altXY'), rdSrc(x, y, 'altY'), xpos);
      dest[at(x, y)] = alphaBlend(bottomBlend, topBlend, ypos);
    }
  }

  return dest;
}
