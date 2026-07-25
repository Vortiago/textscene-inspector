import { describe, it, expect } from 'vitest';
import {
  parseGradient,
  parseGradientTexture2D,
  parsePackedColorArray,
  parsePackedFloat32Array,
} from './parser';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';

describe('parsePackedFloat32Array', () => {
  it('parses a comma-separated float run', () => {
    expect(parsePackedFloat32Array('PackedFloat32Array(0, 0.642276, 1)')).toEqual([
      0, 0.642276, 1,
    ]);
  });

  it('returns an empty array for an empty literal', () => {
    expect(parsePackedFloat32Array('PackedFloat32Array()')).toEqual([]);
  });

  it('throws on a non-matching wrapper', () => {
    expect(() => parsePackedFloat32Array('PackedInt32Array(1, 2)')).toThrow();
  });

  it('throws when a component is not a number', () => {
    expect(() => parsePackedFloat32Array('PackedFloat32Array(1, x, 3)')).toThrow();
  });
});

describe('parsePackedColorArray', () => {
  it('groups the flat run into RGBA quadruples', () => {
    const colors = parsePackedColorArray(
      'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)'
    );
    expect(colors).toEqual([
      { r: 1, g: 1, b: 1, a: 1 },
      { r: 1, g: 1, b: 1, a: 0.180392 },
      { r: 1, g: 1, b: 1, a: 0 },
    ]);
  });

  it('drops a trailing partial quadruple', () => {
    const colors = parsePackedColorArray('PackedColorArray(1, 0, 0, 1, 0, 1)');
    expect(colors).toEqual([{ r: 1, g: 0, b: 0, a: 1 }]);
  });
});

describe('parseGradient', () => {
  it('pairs offsets with colors into sorted stops (the coin gradient)', () => {
    const gradient = parseGradient({
      interpolation_mode: '2',
      offsets: 'PackedFloat32Array(0, 0.642276, 1)',
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    });

    expect(gradient.interpolationMode).toBe(GradientInterpolationMode.Cubic);
    expect(gradient.stops).toEqual([
      { offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
      { offset: 0.642276, color: { r: 1, g: 1, b: 1, a: 0.180392 } },
      { offset: 1, color: { r: 1, g: 1, b: 1, a: 0 } },
    ]);
  });

  it('defaults interpolation_mode to linear and spreads colours evenly when offsets are absent', () => {
    const gradient = parseGradient({
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0)',
    });

    expect(gradient.interpolationMode).toBe(GradientInterpolationMode.Linear);
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
  });

  it('sorts stops ascending by offset', () => {
    const gradient = parseGradient({
      offsets: 'PackedFloat32Array(1, 0)',
      colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
    });
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
    expect(gradient.stops[0]!.color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('is empty (not throwing) for malformed arrays', () => {
    const gradient = parseGradient({ colors: 'PackedColorArray(oops', offsets: 'garbage' });
    expect(gradient.stops).toEqual([]);
  });
});

describe('parseGradientTexture2D', () => {
  it('reads the coin texture fields and defaults the rest', () => {
    const tex = parseGradientTexture2D({
      fill: '1',
      fill_from: 'Vector2(0.5, 0.5)',
      fill_to: 'Vector2(0.5, 0.01)',
    });

    expect(tex.fill).toBe(GradientFill.Radial);
    expect(tex.fillFrom).toEqual({ x: 0.5, y: 0.5 });
    expect(tex.fillTo).toEqual({ x: 0.5, y: 0.01 });
    expect(tex.width).toBe(64);
    expect(tex.height).toBe(64);
    expect(tex.repeat).toBe(GradientRepeat.None);
    expect(tex.useHdr).toBe(false);
  });

  it('honours explicit width/height/repeat/use_hdr', () => {
    const tex = parseGradientTexture2D({
      width: '128',
      height: '32',
      repeat: '2',
      use_hdr: 'true',
    });
    expect(tex.width).toBe(128);
    expect(tex.height).toBe(32);
    expect(tex.repeat).toBe(GradientRepeat.Mirror);
    expect(tex.useHdr).toBe(true);
  });

  it('defaults fill to linear from (0,0) to (1,0)', () => {
    const tex = parseGradientTexture2D({});
    expect(tex.fill).toBe(GradientFill.Linear);
    expect(tex.fillFrom).toEqual({ x: 0, y: 0 });
    expect(tex.fillTo).toEqual({ x: 1, y: 0 });
  });
});
