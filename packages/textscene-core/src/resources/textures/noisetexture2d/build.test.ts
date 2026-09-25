/**
 * The image layer Godot owns around the vendored noise generator
 * (`Noise::_get_image`, `_generate_seamless_image`, `Image::bump_map_to_normal_map`):
 * normalization, the seam blend, the bump conversion's channel and the row order.
 * The generator is the official JS port, so it is not re-tested here.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  bumpMapToNormalMap,
  grayToRgba,
  modulateWithGradient,
  noiseImage,
  noiseSampler,
  noiseTextureFits,
  rasterizeNoiseTexture2D,
  seamlessNoiseImage,
  seamlessSkirt,
} from './build';
import { decodeNoiseTexture2D } from './decode';
import type { NoiseTexture2DData } from './types';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import { GradientInterpolationMode, type Gradient } from '../gradienttexture2d/types';
import { IMAGE_MAX_PIXELS, MAX_TEXTURE_EXTENT } from '../../../godot/index.js';

/** A deterministic ramp: value 0 → black, value 1 → red. */
const RAMP: Gradient = {
  stops: [
    { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
    { offset: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
  ],
  interpolationMode: GradientInterpolationMode.Linear,
};

describe('noiseImage', () => {
  it('normalizes to the field\'s own min/max (Godot\'s default)', () => {
    // noise.cpp:87-136: the whole image is sampled, then rescaled, so the darkest
    // pixel is 0 and the brightest 255 whatever the raw range.
    const image = noiseImage((x) => x / 100, 4, 1, false, true);
    expect(image[0]).toBe(0);
    expect(image[3]).toBe(255);
  });

  it('maps the raw -1..1 range when normalize is off', () => {
    // noise.cpp:138-153: value * 127.5 + 127.5.
    const image = noiseImage(() => 0, 2, 1, false, false);
    expect(image[0]).toBe(127);
    expect(noiseImage(() => 1, 1, 1, false, false)[0]).toBe(255);
    expect(noiseImage(() => -1, 1, 1, false, false)[0]).toBe(0);
  });

  it('writes zeroes for a flat field instead of dividing by zero', () => {
    // noise.cpp:120-121: `if (max_val == min_val) ivalue = 0`.
    expect([...noiseImage(() => 0.5, 2, 2, false, true)]).toEqual([0, 0, 0, 0]);
  });

  it('inverts after normalizing', () => {
    const image = noiseImage((x) => x / 100, 4, 1, true, true);
    expect(image[0]).toBe(255);
    expect(image[3]).toBe(0);
  });

  it('samples through the generator offset', () => {
    // fastnoise_lite.cpp:318-325 adds `offset` before generating, so an offset
    // field equals the plain field read further along.
    const data = decodeFastNoiseLite({ offset: 'Vector3(5, 0, 0)' });
    const shifted = noiseSampler(data);
    const plain = noiseSampler(decodeFastNoiseLite({}));
    expect(shifted(0, 0)).toBeCloseTo(plain(5, 0), 10);
  });
});

describe('seamlessNoiseImage with a skirt wider than half the image', () => {
  // `wr` and `rd_dest` wrap on the output size (noise.h:66-67), so past a 0.5
  // skirt the modulo carries writes onto the opposite edge. `seamless_blend_skirt`
  // is PROPERTY_HINT_RANGE "0,1,0.001" (noise_texture_2d.cpp:97), so 1 is legal
  // and the decoder does not clamp it.
  const sample = (x: number, y: number) => ((x * 7 + y * 13) % 251) / 251;

  it('blends the columns the skirt wraps onto, which raw indexing dropped', () => {
    // A raw `dest[x + y * width]` index writes past the Uint8Array's end, a silent no-op.
    const out = seamlessNoiseImage(sample, 16, 16, false, false, 1);
    expect([out[0], out[3], out[16 * 3 + 2], out[16 * 7 + 5]]).toEqual([194, 207, 212, 147]);
  });

  it('leaves a skirt of half the image or less untouched', () => {
    // At or below 0.5 every index is inside the image, so the wrap never engages.
    for (const skirt of [0.1, 0.5]) {
      const out = seamlessNoiseImage(sample, 16, 16, false, false, skirt);
      expect(out).toHaveLength(256);
      expect([...out].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
    }
  });
});

describe('seamlessNoiseImage', () => {
  it('produces edges that match across the wrap', () => {
    // Column 0 and column width-1 are neighbours once the texture tiles, so the
    // blend skirt keeps them close.
    const sample = noiseSampler(decodeFastNoiseLite({ frequency: '0.05' }));
    const width = 64;
    const height = 64;
    const seamless = seamlessNoiseImage(sample, width, height, false, true, 0.1);

    let worst = 0;
    for (let y = 0; y < height; y++) {
      worst = Math.max(worst, Math.abs(seamless[y * width]! - seamless[y * width + width - 1]!));
    }
    // A plain (non-seamless) field of the same generator is the control.
    const plain = noiseImage(sample, width, height, false, true);
    let plainWorst = 0;
    for (let y = 0; y < height; y++) {
      plainWorst = Math.max(plainWorst, Math.abs(plain[y * width]! - plain[y * width + width - 1]!));
    }
    expect(worst).toBeLessThan(plainWorst);
  });

  it('returns exactly the requested size, not the skirted source size', () => {
    const sample = noiseSampler(decodeFastNoiseLite({}));
    expect(seamlessNoiseImage(sample, 32, 16, false, true, 0.1)).toHaveLength(32 * 16);
  });

  it('keeps a minimum one-pixel skirt for a zero blend skirt', () => {
    // noise.h:106-107: `MAX(1, p_width * p_blend_skirt)`.
    const sample = noiseSampler(decodeFastNoiseLite({}));
    expect(seamlessNoiseImage(sample, 8, 8, false, true, 0)).toHaveLength(64);
  });
});

describe('modulateWithGradient', () => {
  it('maps each pixel\'s luminance through the ramp', () => {
    // noise_texture_2d.cpp:183-198. A grayscale pixel's luminance is its own
    // value, so 0 takes the ramp's first colour and 255 its last.
    const rgba = modulateWithGradient(new Uint8Array([0, 255]), RAMP);
    expect([...rgba.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([255, 0, 0, 255]);
  });
});

describe('bumpMapToNormalMap', () => {
  it('emits a flat +Z normal for a flat height field', () => {
    // image.cpp:4083-4128: every neighbour difference is zero, so the normal is
    // (0, 0, 1), packed as 127.5 + n * 127.5.
    const flat = grayToRgba(new Uint8Array([128, 128, 128, 128]));
    const normals = bumpMapToNormalMap(flat, 4, 2, 2, 8);
    expect([...normals.slice(0, 4)]).toEqual([127, 127, 255, 255]);
  });

  it('tilts the normal against the slope and normalises it', () => {
    // A step up to the right: `across.z` is positive, so the packed X drops
    // below the 127.5 midpoint.
    const ramp = grayToRgba(new Uint8Array([0, 255, 0, 255]));
    const normals = bumpMapToNormalMap(ramp, 4, 2, 2, 1);
    expect(normals[0]!).toBeLessThan(127);
    const [nx = 0, ny = 0, nz = 0] = [normals[0]!, normals[1]!, normals[2]!].map((v) => v / 127.5 - 1);
    expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 1);
    expect(normals[3]).toBe(255);
  });

  it('reads the RED channel, so a colour_ramp feeds it red rather than luminance', () => {
    // Godot converts to FORMAT_RF first (image.cpp:4086), which keeps only red.
    // Two images that differ only in green and blue give the same normals.
    const redOnly = new Uint8Array([10, 200, 200, 255, 250, 200, 200, 255]);
    const redSameOtherChannelsDifferent = new Uint8Array([10, 0, 0, 255, 250, 90, 90, 255]);
    expect([...bumpMapToNormalMap(redOnly, 4, 2, 1, 4)]).toEqual([
      ...bumpMapToNormalMap(redSameOtherChannelsDifferent, 4, 2, 1, 4),
    ]);
  });


  it('reads a raw grayscale field at stride 1 identically to its RGBA expansion', () => {
    // The no-ramp path skips grayToRgba. The stride keeps both forms of one height
    // field byte-identical as normals.
    const gray = new Uint8Array([0, 60, 200, 255, 128, 90]);
    expect([...bumpMapToNormalMap(gray, 1, 3, 2, 8)]).toEqual([
      ...bumpMapToNormalMap(grayToRgba(gray), 4, 3, 2, 8),
    ]);
  });

  it('wraps at the edges rather than clamping', () => {
    // `px = tx + 1; if (px >= width) px -= width`: the last column's right neighbour
    // is the first column, so a seamless height field stays seamless.
    const row = grayToRgba(new Uint8Array([0, 128, 255]));
    const normals = bumpMapToNormalMap(row, 4, 3, 1, 2);
    // The last texel's slope is (first - last), strongly negative, so packed X is
    // above the midpoint.
    expect(normals[(2 << 2) + 0]!).toBeGreaterThan(127);
  });
});

describe('rasterizeNoiseTexture2D', () => {
  const noise = decodeFastNoiseLite({ frequency: '0.05' });

  /** A texture within the ceilings, which always rasterises. */
  function rasterized(
    tex: NoiseTexture2DData,
    fastNoise: FastNoiseLiteData,
    colorRamp: Gradient | null
  ): THREE.DataTexture {
    const texture = rasterizeNoiseTexture2D(tex, fastNoise, colorRamp);
    if (!texture) throw new Error(`expected a texture for ${tex.width}x${tex.height}, got null`);
    return texture;
  }

  it('produces a DataTexture of the declared size', () => {
    const texture = rasterized(
      decodeNoiseTexture2D({ width: '16', height: '8' }),
      noise,
      null
    );
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.image.width).toBe(16);
    expect(texture.image.height).toBe(8);
    expect(texture.image.data).toHaveLength(16 * 8 * 4);
  });

  it('writes rows bottom-up so it matches a file-backed texture\'s orientation', () => {
    // flipY does not apply to a typed-array source, so Godot's top row lands last
    // in the buffer.
    const tex = decodeNoiseTexture2D({ width: '1', height: '2' });
    const texture = rasterized(tex, noise, null);
    const data = texture.image.data as Uint8Array;
    const topRowValue = noiseImage(noiseSampler(noise), 1, 2, false, true)[0]!;
    // The buffer's first row is Godot's last row, so the top row's value is at the end.
    expect(data[4]).toBe(topRowValue);
  });

  it('runs colour ramp then bump conversion, in Godot\'s order', () => {
    // noise_texture_2d.cpp:170-175: modulate first, then bump_map_to_normal_map,
    // so the normal map comes from the ramped red channel.
    const texture = rasterized(
      decodeNoiseTexture2D({ width: '8', height: '8', as_normal_map: 'true' }),
      noise,
      RAMP
    );
    const data = texture.image.data as Uint8Array;
    // Every pixel is a unit normal packed around the midpoint, and opaque.
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 3]).toBe(255);
      const [nx = 0, ny = 0, nz = 0] = [data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v / 127.5 - 1);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 1);
    }
  });

  it('keeps a normal map out of sRGB, and a colour texture in it', () => {
    const normal = rasterized(
      decodeNoiseTexture2D({ width: '4', height: '4', as_normal_map: 'true' }),
      noise,
      null
    );
    const albedo = rasterized(decodeNoiseTexture2D({ width: '4', height: '4' }), noise, RAMP);
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(albedo.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('tiles a seamless texture and clamps a plain one', () => {
    const seamless = rasterized(
      decodeNoiseTexture2D({ width: '8', height: '8', seamless: 'true' }),
      noise,
      null
    );
    const plain = rasterized(decodeNoiseTexture2D({ width: '8', height: '8' }), noise, null);
    expect(seamless.wrapS).toBe(THREE.RepeatWrapping);
    expect(plain.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('is deterministic for the same settings and seed', () => {
    const tex = decodeNoiseTexture2D({ width: '8', height: '8' });
    const a = rasterized(tex, noise, null).image.data as Uint8Array;
    const b = rasterized(tex, noise, null).image.data as Uint8Array;
    expect([...a]).toEqual([...b]);
  });

  it('produces a different field for a different seed', () => {
    const tex = decodeNoiseTexture2D({ width: '8', height: '8' });
    const a = rasterized(tex, noise, null).image.data as Uint8Array;
    const b = rasterized(tex, decodeFastNoiseLite({ frequency: '0.05', seed: '99' }), null)
      .image.data as Uint8Array;
    expect([...a]).not.toEqual([...b]);
  });

  it("draws a texture whose axis sits exactly at the previewer's texture ceiling", () => {
    const texture = rasterized(
      decodeNoiseTexture2D({ width: String(MAX_TEXTURE_EXTENT), height: '1' }),
      noise,
      null
    );
    expect(texture.image.width).toBe(MAX_TEXTURE_EXTENT);
  });

  it('draws no texture, and allocates nothing, for an int32-sized axis Godot opens', () => {
    // The hint is `1,2048,1,or_greater`, so the inspector accepts this width.
    const tex = decodeNoiseTexture2D({ width: '2147483647', height: '512' });
    expect(rasterizeNoiseTexture2D(tex, noise, null)).toBeNull();
  });

  it('draws no texture for a seamless one whose skirted source Godot cannot build', () => {
    const side = String(MAX_TEXTURE_EXTENT);
    const tex = decodeNoiseTexture2D({ width: side, height: side, seamless: 'true' });
    expect(rasterizeNoiseTexture2D(tex, noise, null)).toBeNull();
  });
});

describe('noiseTextureFits', () => {
  const plain = (width: number, height: number): NoiseTexture2DData =>
    decodeNoiseTexture2D({ width: String(width), height: String(height) });

  const seamless = (width: number, height: number, blendSkirt = 0.1): NoiseTexture2DData =>
    decodeNoiseTexture2D({
      width: String(width),
      height: String(height),
      seamless: 'true',
      seamless_blend_skirt: String(blendSkirt),
    });

  /** The pixels of the source `_get_seamless_image` builds a skirt larger. */
  const skirtedSource = (tex: NoiseTexture2DData): number =>
    (tex.width + seamlessSkirt(tex.width, tex.seamlessBlendSkirt)) *
    (tex.height + seamlessSkirt(tex.height, tex.seamlessBlendSkirt));

  it("fits Godot's default 512x512 texture", () => {
    expect(noiseTextureFits(plain(512, 512))).toBe(true);
    expect(noiseTextureFits(seamless(512, 512))).toBe(true);
  });

  it("fits an axis at the previewer's texture ceiling and refuses one pixel past it", () => {
    expect(noiseTextureFits(plain(MAX_TEXTURE_EXTENT, 1))).toBe(true);
    expect(noiseTextureFits(plain(MAX_TEXTURE_EXTENT + 1, 1))).toBe(false);
    expect(noiseTextureFits(plain(1, MAX_TEXTURE_EXTENT + 1))).toBe(false);
  });

  it("fits a plain texture at the previewer's texture ceiling on both axes", () => {
    expect(noiseTextureFits(plain(MAX_TEXTURE_EXTENT, MAX_TEXTURE_EXTENT))).toBe(true);
  });

  it('fits a seamless texture whose skirted source is exactly Image::MAX_PIXELS', () => {
    // A zero skirt still adds one pixel per axis (noise.cpp:36-37), so 16383 becomes 16384.
    const tex = seamless(MAX_TEXTURE_EXTENT - 1, MAX_TEXTURE_EXTENT - 1, 0);
    expect(skirtedSource(tex)).toBe(IMAGE_MAX_PIXELS);
    expect(noiseTextureFits(tex)).toBe(true);
  });

  it('refuses a seamless texture one row taller than an Image::MAX_PIXELS source', () => {
    const tex = seamless(MAX_TEXTURE_EXTENT - 1, MAX_TEXTURE_EXTENT, 0);
    expect(skirtedSource(tex)).toBeGreaterThan(IMAGE_MAX_PIXELS);
    expect(noiseTextureFits(tex)).toBe(false);
  });

  it('refuses a full-size seamless texture, whose skirt passes Image::MAX_PIXELS', () => {
    const tex = seamless(MAX_TEXTURE_EXTENT, MAX_TEXTURE_EXTENT);
    expect(skirtedSource(tex)).toBeGreaterThan(IMAGE_MAX_PIXELS);
    expect(noiseTextureFits(tex)).toBe(false);
  });
});

describe('seamlessSkirt', () => {
  it('generates the blend fraction of the size, truncated', () => {
    expect(seamlessSkirt(512, 0.1)).toBe(51);
  });

  it('generates at least one pixel, however small the fraction', () => {
    expect(seamlessSkirt(4, 0.1)).toBe(1);
    expect(seamlessSkirt(512, 0)).toBe(1);
  });

  it('doubles the size at the largest skirt the setter accepts', () => {
    expect(seamlessSkirt(512, 1)).toBe(512);
  });
});
