import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  gradientOffsetAt,
  rasterizeGradientTexture2D,
  sampleGradientColor,
} from './renderer';
import { parseGradient, parseGradientTexture2D } from './parser';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';
import type { Gradient, GradientTexture2D } from './types';

// The coin's radial white→transparent falloff, cubic-interpolated.
const coinGradient = (): Gradient =>
  parseGradient({
    interpolation_mode: '2',
    offsets: 'PackedFloat32Array(0, 0.642276, 1)',
    colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
  });

const coinTexture = (): GradientTexture2D =>
  parseGradientTexture2D({
    fill: '1',
    fill_from: 'Vector2(0.5, 0.5)',
    fill_to: 'Vector2(0.5, 0.01)',
  });

describe('sampleGradientColor', () => {
  it('returns the exact stop colour at an exact offset', () => {
    // The discriminating check: 0.642276 lands exactly on the middle stop.
    expect(sampleGradientColor(coinGradient(), 0.642276).a).toBeCloseTo(0.180392, 6);
  });

  it('returns the endpoint colours at and beyond the ends', () => {
    const g = coinGradient();
    expect(sampleGradientColor(g, 0).a).toBeCloseTo(1, 6);
    expect(sampleGradientColor(g, 1).a).toBeCloseTo(0, 6);
    // Offsets outside the stop range clamp to the nearest endpoint.
    expect(sampleGradientColor(g, -0.5).a).toBeCloseTo(1, 6);
    expect(sampleGradientColor(g, 1.5).a).toBeCloseTo(0, 6);
  });

  it('cubic interpolation differs from linear between stops (locks the curve)', () => {
    const cubic = coinGradient();
    const linear: Gradient = { ...cubic, interpolationMode: GradientInterpolationMode.Linear };
    // Midpoint of the first segment (weight 0.5). Linear = (1 + 0.180392)/2.
    const mid = 0.642276 / 2;
    expect(sampleGradientColor(linear, mid).a).toBeCloseTo(0.590196, 5);
    // Godot's Catmull-Rom (p0 clamped to first, p3 = last) lifts it above linear.
    expect(sampleGradientColor(cubic, mid).a).toBeCloseTo(0.601471, 4);
  });

  it('constant interpolation holds the lower stop', () => {
    const g: Gradient = { ...coinGradient(), interpolationMode: GradientInterpolationMode.Constant };
    expect(sampleGradientColor(g, 0.3).a).toBeCloseTo(1, 6);
    expect(sampleGradientColor(g, 0.8).a).toBeCloseTo(0.180392, 6);
  });

  it('handles a single-stop gradient', () => {
    const g: Gradient = {
      stops: [{ offset: 0, color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } }],
      interpolationMode: GradientInterpolationMode.Linear,
    };
    expect(sampleGradientColor(g, 0.5)).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 1 });
  });
});

describe('gradientOffsetAt', () => {
  it('radial: 0 at the fill origin, clamps to 1 at the far edge', () => {
    const tex = coinTexture(); // 64×64, from (0.5,0.5) to (0.5,0.01)
    // Pixel nearest the centre (posX=posY≈0.5).
    expect(gradientOffsetAt(tex, 31, 31)).toBeLessThan(0.05);
    // Top-centre pixel: distance 0.5 / 0.49 > 1 → clamped.
    expect(gradientOffsetAt(tex, 31, 0)).toBe(1);
    // A corner is even further → still clamped to 1.
    expect(gradientOffsetAt(tex, 0, 0)).toBe(1);
  });

  it('linear: is the projection parameter along the fill vector', () => {
    const tex: GradientTexture2D = {
      width: 3,
      height: 1,
      fill: GradientFill.Linear,
      fillFrom: { x: 0, y: 0 },
      fillTo: { x: 1, y: 0 },
      repeat: GradientRepeat.None,
      useHdr: false,
    };
    expect(gradientOffsetAt(tex, 0, 0)).toBeCloseTo(0, 6);
    expect(gradientOffsetAt(tex, 1, 0)).toBeCloseTo(0.5, 6);
    expect(gradientOffsetAt(tex, 2, 0)).toBeCloseTo(1, 6);
  });

  it('square: uses chebyshev distance', () => {
    const tex: GradientTexture2D = {
      width: 3,
      height: 3,
      fill: GradientFill.Square,
      fillFrom: { x: 0.5, y: 0.5 },
      fillTo: { x: 1, y: 0.5 },
      repeat: GradientRepeat.None,
      useHdr: false,
    };
    // Corner (0,0): max(|−0.5|,|−0.5|)/max(0.5,0) = 1.
    expect(gradientOffsetAt(tex, 0, 0)).toBeCloseTo(1, 6);
    // Centre: 0.
    expect(gradientOffsetAt(tex, 1, 1)).toBeCloseTo(0, 6);
  });

  it('returns 0 when fill_from equals fill_to', () => {
    const tex: GradientTexture2D = {
      width: 4,
      height: 4,
      fill: GradientFill.Radial,
      fillFrom: { x: 0.5, y: 0.5 },
      fillTo: { x: 0.5, y: 0.5 },
      repeat: GradientRepeat.None,
      useHdr: false,
    };
    expect(gradientOffsetAt(tex, 3, 3)).toBe(0);
  });
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
    // The orientation nothing covered, which is why a linear gradient rendered
    // upside-down against the same gradient shipped as a PNG. A DataTexture is
    // uploaded from a typed array, and WebGL's UNPACK_FLIP_Y does not apply to
    // those — so `flipY` cannot express this and the BUFFER has to carry it.
    // Every 2D UV path here assumes the flipY=true layout, i.e. v = 1 samples
    // the last row of the buffer and must hold Godot's top row.
    const tex: GradientTexture2D = {
      width: 1,
      height: 4,
      fill: GradientFill.LINEAR,
      fillFrom: { x: 0, y: 0 },
      fillTo: { x: 0, y: 1 },
      repeat: GradientRepeat.NONE,
      gradient: null,
    };
    // Black at Godot's top (offset 0), white at Godot's bottom (offset 1).
    const gradient: Gradient = {
      interpolationMode: GradientInterpolationMode.LINEAR,
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
    // Corner: fully faded (RGB stays white; alpha goes to 0).
    const corner = at(0, 0);
    expect(corner.r).toBe(255);
    expect(corner.a).toBe(0);
  });
});
