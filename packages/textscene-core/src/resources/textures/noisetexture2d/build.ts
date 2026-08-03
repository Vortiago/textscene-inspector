/**
 * NoiseTexture2D build — decoded settings plus a resolved gradient into the
 * pixels Godot's `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order:
 *
 *   noise image (seamless or plain) → color_ramp modulation → bump-to-normal
 *
 * The generator itself is NOT hand-ported: `fastnoise-lite` is the official JS
 * port of the same upstream library Godot vendors as
 * `thirdparty/misc/FastNoiseLite.h`, so the same settings and seed produce the
 * same field. Only the IMAGE layer around it is ported here, because that layer
 * is Godot's own (normalization, the seamless blend skirt, the bump-map
 * conversion), and each piece cites the line it comes from.
 *
 * DOMAIN WARP IS NOT APPLIED. Godot warps the sample position through a second
 * generator (`fastnoise_lite.cpp:318-325`), but the JS port's entry point —
 * spelled `DomainWrap` — dispatches on `arguments[0] instanceof Vector2` against
 * a class it does not export, so a caller outside the module cannot drive it
 * (verified against 1.1.1: a plain `{x, y}` comes back unchanged). Eleven corpus
 * resources set `domain_warp_enabled`; they render their unwarped field, which
 * is the same generator with straight coordinates. Recorded in
 * `resources/textures/comparison.md`.
 */

import * as THREE from 'three';
import FastNoiseLite from 'fastnoise-lite';
import { channelToByte } from '../../../utils/colorSpace';
import type { Gradient } from '../gradienttexture2d/types';
import { sampleGradientColor } from '../gradienttexture2d/sample';
import {
  CellularDistanceFunction,
  CellularReturnType,
  NoiseFractalType,
  NoiseType,
  type FastNoiseLiteData,
} from '../../noise/fastnoiselite/types';
import type { NoiseTexture2DData } from './types';

const NOISE_TYPE: Record<NoiseType, string> = {
  [NoiseType.SIMPLEX]: FastNoiseLite.NoiseType.OpenSimplex2,
  [NoiseType.SIMPLEX_SMOOTH]: FastNoiseLite.NoiseType.OpenSimplex2S,
  [NoiseType.CELLULAR]: FastNoiseLite.NoiseType.Cellular,
  [NoiseType.PERLIN]: FastNoiseLite.NoiseType.Perlin,
  [NoiseType.VALUE_CUBIC]: FastNoiseLite.NoiseType.ValueCubic,
  [NoiseType.VALUE]: FastNoiseLite.NoiseType.Value,
};

const FRACTAL_TYPE: Record<NoiseFractalType, string> = {
  [NoiseFractalType.NONE]: FastNoiseLite.FractalType.None,
  [NoiseFractalType.FBM]: FastNoiseLite.FractalType.FBm,
  [NoiseFractalType.RIDGED]: FastNoiseLite.FractalType.Ridged,
  [NoiseFractalType.PING_PONG]: FastNoiseLite.FractalType.PingPong,
};

const DISTANCE_FUNCTION: Record<CellularDistanceFunction, string> = {
  [CellularDistanceFunction.EUCLIDEAN]: FastNoiseLite.CellularDistanceFunction.Euclidean,
  [CellularDistanceFunction.EUCLIDEAN_SQUARED]: FastNoiseLite.CellularDistanceFunction.EuclideanSq,
  [CellularDistanceFunction.MANHATTAN]: FastNoiseLite.CellularDistanceFunction.Manhattan,
  [CellularDistanceFunction.HYBRID]: FastNoiseLite.CellularDistanceFunction.Hybrid,
};

const RETURN_TYPE: Record<CellularReturnType, string> = {
  [CellularReturnType.CELL_VALUE]: FastNoiseLite.CellularReturnType.CellValue,
  [CellularReturnType.DISTANCE]: FastNoiseLite.CellularReturnType.Distance,
  [CellularReturnType.DISTANCE2]: FastNoiseLite.CellularReturnType.Distance2,
  [CellularReturnType.DISTANCE2_ADD]: FastNoiseLite.CellularReturnType.Distance2Add,
  [CellularReturnType.DISTANCE2_SUB]: FastNoiseLite.CellularReturnType.Distance2Sub,
  [CellularReturnType.DISTANCE2_MUL]: FastNoiseLite.CellularReturnType.Distance2Mul,
  [CellularReturnType.DISTANCE2_DIV]: FastNoiseLite.CellularReturnType.Distance2Div,
};

/** A sampler over the configured generator, offset like `get_noise_2d`. */
export type NoiseSampler = (x: number, y: number) => number;

/**
 * The generator a decoded `FastNoiseLite` describes, as a 2D sampler.
 * `offset` is added to the position before generating, exactly as
 * `FastNoiseLite::get_noise_2d` does (fastnoise_lite.cpp:318-325).
 */
export function noiseSampler(data: FastNoiseLiteData): NoiseSampler {
  const noise = new FastNoiseLite();
  noise.SetSeed(data.seed);
  noise.SetFrequency(data.frequency);
  noise.SetNoiseType(NOISE_TYPE[data.noiseType]);
  noise.SetFractalType(FRACTAL_TYPE[data.fractalType]);
  noise.SetFractalOctaves(data.fractalOctaves);
  noise.SetFractalLacunarity(data.fractalLacunarity);
  noise.SetFractalGain(data.fractalGain);
  noise.SetFractalWeightedStrength(data.fractalWeightedStrength);
  noise.SetFractalPingPongStrength(data.fractalPingPongStrength);
  noise.SetCellularDistanceFunction(DISTANCE_FUNCTION[data.cellularDistanceFunction]);
  noise.SetCellularReturnType(RETURN_TYPE[data.cellularReturnType]);
  noise.SetCellularJitter(data.cellularJitter);

  const { x: ox, y: oy } = data.offset;
  return (x, y) => noise.GetNoise(x + ox, y + oy);
}

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

  // Swap the quadrants so the edges are perfect matches.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      dest[x + y * width] = rdSrc(x, y, 'altXY');
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
      dest[x + y * width] = alphaBlend(dest[x + y * width]!, rdSrc(x, y, 'altY'), alpha);
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
      dest[x + y * width] = alphaBlend(dest[x + y * width]!, rdSrc(x, y, 'altX'), alpha);
    }
  }

  // Fill in the centre square, where both skirts overlap.
  for (let y = halfHeight; y < skirtEdgeY; y++) {
    for (let x = halfWidth; x < skirtEdgeX; x++) {
      const xpos = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (x - halfWidth) / skirtWidth)));
      const ypos = Math.trunc(255 * (1 - smoothstep(0.1, 0.9, (y - halfHeight) / skirtHeight)));
      const topBlend = alphaBlend(rdSrc(x, y, 'altX'), rdSrc(x, y, 'default'), xpos);
      const bottomBlend = alphaBlend(rdSrc(x, y, 'altXY'), rdSrc(x, y, 'altY'), xpos);
      dest[x + y * width] = alphaBlend(bottomBlend, topBlend, ypos);
    }
  }

  return dest;
}

/**
 * `NoiseTexture2D::_modulate_with_gradient` (noise_texture_2d.cpp:183-198):
 * each pixel's LUMINANCE is the offset into the ramp. A grayscale pixel's
 * luminance is its own value (Godot's weights sum to 1 over equal channels), so
 * the byte maps straight to the 0..1 ramp offset.
 */
export function modulateWithGradient(gray: Uint8Array, gradient: Gradient): Uint8Array {
  // The offset domain is a byte / 255 — 256 distinct values — so the ramp is
  // evaluated once per value, not once per pixel (a megapixel field would
  // otherwise pay a binary search and a colour allocation per pixel).
  const lut = new Uint8Array(256 * 4);
  for (let v = 0; v < 256; v++) {
    const color = sampleGradientColor(gradient, v / 255);
    lut[v * 4] = channelToByte(color.r);
    lut[v * 4 + 1] = channelToByte(color.g);
    lut[v * 4 + 2] = channelToByte(color.b);
    lut[v * 4 + 3] = channelToByte(color.a);
  }

  const rgba = new Uint8Array(gray.length * 4);
  for (let i = 0; i < gray.length; i++) {
    const entry = gray[i]! * 4;
    rgba[i * 4] = lut[entry]!;
    rgba[i * 4 + 1] = lut[entry + 1]!;
    rgba[i * 4 + 2] = lut[entry + 2]!;
    rgba[i * 4 + 3] = lut[entry + 3]!;
  }
  return rgba;
}

/** A grayscale field as opaque RGBA, for the path with no `color_ramp`. */
export function grayToRgba(gray: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(gray.length * 4);
  for (let i = 0; i < gray.length; i++) {
    rgba[i * 4] = gray[i]!;
    rgba[i * 4 + 1] = gray[i]!;
    rgba[i * 4 + 2] = gray[i]!;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * `Image::bump_map_to_normal_map` (core/io/image.cpp:4083-4128).
 *
 * Godot converts the image to `FORMAT_RF` first, which keeps only the RED
 * channel — so after a `color_ramp` the height field is the ramp's red, not its
 * luminance. `stride` names where that channel sits: 4 for an RGBA field (the
 * ramped path), 1 for a raw grayscale field, which spares the no-ramp path a
 * full RGBA expansion it would read one byte in four of. Neighbours wrap at the
 * edges, and the normal is `across x up` normalised, packed as
 * `127.5 + n * 127.5`.
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

/**
 * The whole pipeline as a `THREE.DataTexture`.
 *
 * Rows are written BOTTOM-UP for the same reason the GradientTexture2D
 * rasteriser does it: `flipY` does not apply to a typed-array source, and every
 * UV path in the repo is written for the flipY convention a file-backed texture
 * gets, so Godot's top row has to land last in the buffer.
 */
export function rasterizeNoiseTexture2D(
  tex: NoiseTexture2DData,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): THREE.DataTexture {
  const width = Math.max(1, Math.trunc(tex.width));
  const height = Math.max(1, Math.trunc(tex.height));
  const sample = noiseSampler(noise);

  const gray = tex.seamless
    ? seamlessNoiseImage(sample, width, height, tex.invert, tex.normalize, tex.seamlessBlendSkirt)
    : noiseImage(sample, width, height, tex.invert, tex.normalize);

  let rgba: Uint8Array;
  if (tex.asNormalMap) {
    // The bump conversion reads only the red channel, so the no-ramp path feeds
    // it the grayscale field directly instead of expanding to RGBA first.
    rgba = colorRamp
      ? bumpMapToNormalMap(modulateWithGradient(gray, colorRamp), 4, width, height, tex.bumpStrength)
      : bumpMapToNormalMap(gray, 1, width, height, tex.bumpStrength);
  } else {
    rgba = colorRamp ? modulateWithGradient(gray, colorRamp) : grayToRgba(gray);
  }

  const flipped = new Uint8Array(rgba.length);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    flipped.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
  }

  const texture = new THREE.DataTexture(flipped, width, height, THREE.RGBAFormat);
  // A normal map carries directions, not colour: sampling it through sRGB would
  // bend every normal. Godot marks the same distinction with its `srgb` import
  // flag; here the two arrival paths differ only in this one field.
  texture.colorSpace = tex.asNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  // Godot's seamless image exists to be tiled; a non-seamless one is clamped
  // like every other procedural texture here.
  const wrap = tex.seamless ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.needsUpdate = true;
  return texture;
}

/** Godot's `Math::smoothstep`. */
function smoothstep(from: number, to: number, x: number): number {
  if (from === to) return x < from ? 0 : 1;
  const s = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return s * s * (3 - 2 * s);
}

/** `_alpha_blend<uint8_t>` (noise.h:73-79) — integer blend, alpha 0..255. */
function alphaBlend(background: number, foreground: number, alpha: number): number {
  const a = alpha + 1;
  const inv = 256 - alpha;
  return (a * foreground + inv * background) >> 8;
}

function clamp8(value: number): number {
  return Math.min(255, Math.max(0, Math.trunc(value)));
}
