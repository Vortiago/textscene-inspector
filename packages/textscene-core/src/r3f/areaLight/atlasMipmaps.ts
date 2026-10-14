/**
 * The pixels of Godot 4.7.2's area light atlas (`texture_storage.cpp:3465-3550`). Mip 0 holds each
 * texture decoded from sRGB. Each later mip blurs the one before it through the Gaussian of
 * `copy.glsl` while it halves it, in sRGB, and stores it decoded.
 */

/*
 * The mip chain is derived from Godot Engine
 * (`servers/rendering/renderer_rd/storage_rd/texture_storage.cpp` and
 * `servers/rendering/renderer_rd/shaders/effects/copy.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import { channelToByte, sRGBChannelToLinear } from '../../utils/colorSpace.js';
import type { AreaTextureImage } from './atlasLayout.js';

/** The atlas's mip count (`texture_storage.h:279`). */
export const AREA_LIGHT_ATLAS_MIPMAPS = 8;

/** A texture where the atlas holds it, in mip 0's texels. */
export interface PlacedTexture {
  image: AreaTextureImage;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** RGBA in 0 to 1, first row the top row. */
interface Pixels {
  width: number;
  height: number;
  data: Float32Array;
}

/** `copy.glsl`'s kernel without glow, from the centre tap out (`:118`). */
const BLUR_KERNEL = [0.214607, 0.189879, 0.131514, 0.071303] as const;

/** The blur's thread groups are 8 texels wide, and each reads its own window (`copy.glsl:9`). */
const BLUR_GROUP_SIDE = 8;

/**
 * `srgb_to_linear` (`copy_to_fb.glsl:113-115`), which the GPU's sRGB view of mip 0 matches, for
 * each byte: every value this decodes is a byte over 255.
 */
const LINEAR_OF_BYTE = Float32Array.from({ length: 256 }, (_, byte) => sRGBChannelToLinear(byte / 255));

function quantised(pixels: Pixels): Pixels {
  const data = new Float32Array(pixels.data.length);
  for (let i = 0; i < data.length; i++) data[i] = channelToByte(pixels.data[i]!) / 255;
  return { ...pixels, data };
}

function rgbDecoded(pixels: Pixels): Pixels {
  const data = pixels.data.slice();
  for (let i = 0; i < data.length; i++) if (i % 4 !== 3) data[i] = LINEAR_OF_BYTE[channelToByte(data[i]!)]!;
  return { ...pixels, data };
}

/** A plain loop, not `Float32Array.from` with a map: a callback per byte costs more than the blur. */
function pixelsOf(image: AreaTextureImage): Pixels {
  const data = new Float32Array(image.data.length);
  for (let i = 0; i < data.length; i++) data[i] = image.data[i]! / 255;
  return { width: image.width, height: image.height, data };
}

/** A clamped bilinear tap at `coordinate`, in texels, as the two texels and the far one's weight. */
function bilinearTaps(coordinate: number, size: number): [number, number, number] {
  const x = coordinate - 0.5;
  const low = Math.floor(x);
  const clampIndex = (index: number) => Math.min(Math.max(index, 0), size - 1);
  return [clampIndex(low), clampIndex(low + 1), x - low];
}

/**
 * `source` resampled along `axis` to `targetSize` texels, the other axis kept. Each target texel
 * sums the bilinear samples `tapsAt` gives it, each at a texture coordinate with a weight.
 */
function resampleAxis(
  source: Pixels,
  axis: 'x' | 'y',
  targetSize: number,
  tapsAt: (target: number) => { uv: number; weight: number }[]
): Pixels {
  const isX = axis === 'x';
  const sourceSize = isX ? source.width : source.height;
  const width = isX ? targetSize : source.width;
  const height = isX ? source.height : targetSize;
  const data = new Float32Array(width * height * 4);
  const across = isX ? source.height : source.width;
  for (let target = 0; target < targetSize; target++) {
    for (const { uv, weight } of tapsAt(target)) {
      const [near, far, farWeight] = bilinearTaps(uv * sourceSize, sourceSize);
      for (let line = 0; line < across; line++) {
        const out = isX ? (line * width + target) * 4 : (target * width + line) * 4;
        const nearAt = isX ? (line * source.width + near) * 4 : (near * source.width + line) * 4;
        const farAt = isX ? (line * source.width + far) * 4 : (far * source.width + line) * 4;
        for (let channel = 0; channel < 4; channel++) {
          const sample =
            source.data[nearAt + channel]! * (1 - farWeight) + source.data[farAt + channel]! * farWeight;
          data[out + channel] = data[out + channel]! + sample * weight;
        }
      }
    }
  }
  return { width, height, data };
}

/**
 * One bilinear tap at each target texel's centre: `copy_to_atlas_fb`'s stretch. At the source's own
 * size each tap lands on a texel centre, so the source stands.
 */
function stretched(source: Pixels, width: number, height: number): Pixels {
  if (width === source.width && height === source.height) return source;
  const centre = (size: number) => (target: number) => [{ uv: (target + 0.5) / size, weight: 1 }];
  return resampleAxis(resampleAxis(source, 'x', width, centre(width)), 'y', height, centre(height));
}

/**
 * The texture coordinate of window entry `entry` for the group that starts at `groupStart`. Each
 * thread clamps its first sample to the target and takes the second a target texel further, so
 * past an edge the window alternates between the last two texels (`copy.glsl:98-104`).
 */
function windowUv(groupStart: number, entry: number, size: number): number {
  const isSecond = entry % 2;
  const first = (groupStart + entry - isSecond - 3.5) / size;
  const clamped = Math.min(Math.max(first, 0.5 / size), 1 - 1.5 / size);
  return clamped + isSecond / size;
}

/** The kernel's taps for one target texel along one axis. */
function blurTaps(size: number) {
  return (target: number) => {
    const groupStart = target - (target % BLUR_GROUP_SIDE);
    const centre = (target % BLUR_GROUP_SIDE) + 4;
    const taps = [];
    for (let offset = -3; offset <= 3; offset++) {
      taps.push({ uv: windowUv(groupStart, centre + offset, size), weight: BLUR_KERNEL[Math.abs(offset)]! });
    }
    return taps;
  };
}

/** `gaussian_blur` into a `width × height` RGBA8 target (`copy.glsl:96-205`). */
function blurred(source: Pixels, width: number, height: number): Pixels {
  return quantised(
    resampleAxis(resampleAxis(source, 'x', width, blurTaps(width)), 'y', height, blurTaps(height))
  );
}

/** Writes `pixels` into `mip`, `mipWidth` texels wide, at `x`, `y`. */
function store(mip: Uint8Array, mipWidth: number, pixels: Pixels, x: number, y: number): void {
  for (let row = 0; row < pixels.height; row++) {
    for (let column = 0; column < pixels.width * 4; column++) {
      mip[((y + row) * mipWidth + x) * 4 + column] = channelToByte(
        pixels.data[row * pixels.width * 4 + column]!
      );
    }
  }
}

/** A mip's side: the atlas's side halved `level` times, at least 1. */
export function mipSize(size: number, level: number): number {
  return Math.max(size >> level, 1);
}

/** `raw`'s mips past 0, each blurred from the one before (`:3528-3575`). */
function storeBlurredMips(
  mipmaps: Uint8Array[],
  atlasWidth: number,
  atlasHeight: number,
  placed: PlacedTexture,
  raw: Pixels
) {
  let previous = quantised(stretched(raw, placed.width, placed.height));
  for (let level = 1; level < mipmaps.length; level++) {
    const mipWidth = mipSize(atlasWidth, level);
    const mipHeight = mipSize(atlasHeight, level);
    const width = Math.floor((placed.width * mipWidth) / atlasWidth);
    const height = Math.floor((placed.height * mipHeight) / atlasHeight);
    if (Math.min(width, height) < 1) return;
    previous = blurred(previous, width, height);
    const x = Math.floor((placed.x * mipWidth) / atlasWidth);
    const y = Math.floor((placed.y * mipHeight) / atlasHeight);
    store(mipmaps[level]!, mipWidth, rgbDecoded(previous), x, y);
  }
}

/** The atlas's mips, clear where no texture lies. */
export function areaTextureMipmaps(
  width: number,
  height: number,
  textures: readonly PlacedTexture[]
): Uint8Array[] {
  const mipmaps = Array.from(
    { length: AREA_LIGHT_ATLAS_MIPMAPS },
    (_, level) => new Uint8Array(mipSize(width, level) * mipSize(height, level) * 4)
  );
  for (const placed of textures) {
    const raw = pixelsOf(placed.image);
    store(mipmaps[0]!, width, stretched(rgbDecoded(raw), placed.width, placed.height), placed.x, placed.y);
    storeBlurredMips(mipmaps, width, height, placed, raw);
  }
  return mipmaps;
}
