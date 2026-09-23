import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { rasterizeGradientTexture2D } from './build';
import { decodeGradient, decodeGradientTexture2D } from './decode';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';
import type { Gradient, GradientTexture2D } from './types';

// A radial white-to-transparent falloff, cubic-interpolated.
const coinGradient = (): Gradient =>
  decodeGradient({
    interpolation_mode: '2',
    offsets: 'PackedFloat32Array(0, 0.642276, 1)',
    colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
  });

const coinTexture = (): GradientTexture2D =>
  decodeGradientTexture2D({
    fill: '1',
    fill_from: 'Vector2(0.5, 0.5)',
    fill_to: 'Vector2(0.5, 0.01)',
  });

describe('rasterizeGradientTexture2D', () => {
  it('produces an sRGB, linearly-filtered RGBA8 DataTexture of the right size', () => {
    const texture = rasterizeGradientTexture2D(coinTexture(), coinGradient());
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
  });

  it('puts Godot\'s TOP row at v = 1, matching a file-backed texture', () => {
    // WebGL's UNPACK_FLIP_Y does not apply to a typed-array DataTexture, so the
    // buffer carries the flip: v = 1 samples the last row, Godot's top row.
    const tex: GradientTexture2D = {
      width: 1,
      height: 4,
      fill: GradientFill.Linear,
      fillFrom: { x: 0, y: 0 },
      fillTo: { x: 0, y: 1 },
      repeat: GradientRepeat.None,
      useHdr: false,
    };
    // Black at Godot's top (offset 0), white at Godot's bottom (offset 1).
    const gradient: Gradient = {
      interpolationMode: GradientInterpolationMode.Linear,
      stops: [
        { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
        { offset: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
      ],
    };
    const data = rasterizeGradientTexture2D(tex, gradient).image.data as Uint8Array;
    const row = (y: number) => data[y * 4]!;
    // Buffer row 0 is v = 0, which must be Godot's BOTTOM (white).
    expect(row(0)).toBeGreaterThan(row(3));
    // ...and the last buffer row is v = 1, Godot's top (black).
    expect(row(3)).toBeLessThan(64);
  });

  it('centre pixel ≈ first stop (opaque white), corner ≈ last stop (transparent)', () => {
    const texture = rasterizeGradientTexture2D(coinTexture(), coinGradient());
    const data = texture.image.data as Uint8Array;
    const at = (x: number, y: number) => {
      const i = (x + y * 64) * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    };
    // Near the centre: opaque white glow core.
    const centre = at(32, 32);
    expect(centre.r).toBe(255);
    expect(centre.g).toBe(255);
    expect(centre.b).toBe(255);
    expect(centre.a).toBeGreaterThan(240);
    // Corner: fully faded. RGB stays white and alpha goes to 0.
    const corner = at(0, 0);
    expect(corner.r).toBe(255);
    expect(corner.a).toBe(0);
  });
});
