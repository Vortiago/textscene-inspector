import { describe, it, expect } from 'vitest';
import { decodeGradientTexture2D, resolveGradient } from './decode';
import { gradientOf } from './gradient.testkit';
import type { TscnInternalResource } from '../../../parser/types';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';
import { GRADIENT_TEXTURE_MAX_SIZE } from '../../../godot/index.js';

/** The stop colours a Gradient with this `colors` value decodes to. */
function colorsOf(colors: string) {
  return gradientOf({ colors }).stops.map((stop) => stop.color);
}

describe('the colors a Gradient reads', () => {
  it('groups the flat run into RGBA quadruples of the float32 a Color stores', () => {
    const colors = colorsOf('PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)');
    expect(colors).toEqual([
      { r: 1, g: 1, b: 1, a: 1 },
      { r: 1, g: 1, b: 1, a: Math.fround(0.180392) },
      { r: 1, g: 1, b: 1, a: 0 },
    ]);
  });

  it('reads the typed and bare spellings, whose bodies hold Color() elements', () => {
    // `can_convert_strict` lists ARRAY as a valid source for PACKED_COLOR_ARRAY
    // (variant.cpp:467-473) and `Gradient::set_colors` (gradient.cpp:81) takes
    // the converted array, so both load.
    const expected = [
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
    ];
    expect(colorsOf('[Color(1, 0, 0, 1), Color(0, 0, 1, 1)]')).toEqual(expected);
    expect(colorsOf('Array[Color]([Color(1, 0, 0, 1), Color(0, 0, 1, 1)])')).toEqual(expected);
    expect(colorsOf('[]')).toEqual([]);
  });

  it('drops a trailing partial quadruple', () => {
    const colors = colorsOf('PackedColorArray(1, 0, 0, 1, 0, 1)');
    expect(colors).toEqual([{ r: 1, g: 0, b: 0, a: 1 }]);
  });
});

describe('the Gradient body resolveGradient decodes', () => {
  it('pairs offsets with colors into sorted float32 stops (the coin gradient)', () => {
    const gradient = gradientOf({
      interpolation_mode: '2',
      offsets: 'PackedFloat32Array(0, 0.642276, 1)',
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    });

    expect(gradient.interpolationMode).toBe(GradientInterpolationMode.Cubic);
    expect(gradient.stops).toEqual([
      { offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
      { offset: Math.fround(0.642276), color: { r: 1, g: 1, b: 1, a: Math.fround(0.180392) } },
      { offset: 1, color: { r: 1, g: 1, b: 1, a: 0 } },
    ]);
  });

  it('defaults interpolation_mode to linear and spreads colours evenly when offsets are absent', () => {
    const gradient = gradientOf({
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0)',
    });

    expect(gradient.interpolationMode).toBe(GradientInterpolationMode.Linear);
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
  });

  it('sorts stops ascending by offset', () => {
    const gradient = gradientOf({
      offsets: 'PackedFloat32Array(1, 0)',
      colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
    });
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
    expect(gradient.stops[0]!.color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('is empty (not throwing) for malformed arrays', () => {
    const gradient = gradientOf({ colors: 'PackedColorArray(oops', offsets: 'garbage' });
    expect(gradient.stops).toEqual([]);
  });

  it('decodes an empty body to a stopless linear gradient (edge case)', () => {
    expect(gradientOf({})).toEqual({ stops: [], interpolationMode: GradientInterpolationMode.Linear });
  });
});

describe('decodeGradientTexture2D', () => {
  it('reads the coin texture fields and defaults the rest', () => {
    const tex = decodeGradientTexture2D({
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
    const tex = decodeGradientTexture2D({
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
    const tex = decodeGradientTexture2D({});
    expect(tex.fill).toBe(GradientFill.Linear);
    expect(tex.fillFrom).toEqual({ x: 0, y: 0 });
    expect(tex.fillTo).toEqual({ x: 1, y: 0 });
  });

  // gradient_texture.cpp:324 and :335 refuse outside 1 to 16384, so the 64 default stays.
  it.each(['0', '-5', '16385', '2147483647'])('keeps the 64 default for a %s axis', (size) => {
    const tex = decodeGradientTexture2D({ width: size, height: size });
    expect(tex.width).toBe(64);
    expect(tex.height).toBe(64);
  });

  it('keeps an axis of 16384, the largest the size setters accept', () => {
    const tex = decodeGradientTexture2D({ width: '16384', height: '16384' });
    expect(tex.width).toBe(GRADIENT_TEXTURE_MAX_SIZE);
    expect(tex.height).toBe(GRADIENT_TEXTURE_MAX_SIZE);
  });

  it('keeps an axis of 1, the smallest the size setters accept', () => {
    const tex = decodeGradientTexture2D({ width: '1', height: '1' });
    expect(tex).toMatchObject({ width: 1, height: 1 });
  });

  it('refuses one axis without touching the other', () => {
    const tex = decodeGradientTexture2D({ width: '16385', height: '32' });
    expect(tex).toMatchObject({ width: 64, height: 32 });
  });
});

/** A two-stop ramp: opaque orange fading to transparent. */
const ORANGE_RAMP = {
  offsets: 'PackedFloat32Array(0, 1)',
  colors: 'PackedColorArray(1, 0.6, 0.2, 1, 1, 0.6, 0.2, 0)',
};

const RAMP_RESOURCE: TscnInternalResource = {
  type: 'Gradient',
  id: '3',
  data: { ...ORANGE_RAMP },
};

describe('resolveGradient', () => {
  it('decodes the Gradient a SubResource reference names (happy path)', () => {
    const gradient = resolveGradient('SubResource("3")', [RAMP_RESOURCE]);
    expect(gradient?.stops).toHaveLength(2);
    expect(gradient?.stops[0]!.color).toEqual({ r: 1, g: Math.fround(0.6), b: Math.fround(0.2), a: 1 });
  });

  it('returns null when the reference names a different resource type (error path)', () => {
    const curve: TscnInternalResource = { type: 'Curve', id: '3', data: {} };
    expect(resolveGradient('SubResource("3")', [curve])).toBeNull();
  });

  it('returns null for an absent or non-SubResource reference (edge case)', () => {
    expect(resolveGradient(undefined, [RAMP_RESOURCE])).toBeNull();
    expect(resolveGradient('ExtResource("3")', [RAMP_RESOURCE])).toBeNull();
    expect(resolveGradient('SubResource("nope")', [RAMP_RESOURCE])).toBeNull();
  });
});
