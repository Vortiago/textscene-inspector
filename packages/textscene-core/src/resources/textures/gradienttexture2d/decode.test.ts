import { describe, it, expect } from 'vitest';
import {
  gradientFromResource,
  decodeGradient,
  decodeGradientTexture2D,
  parseColorStops,
  parsePackedFloat32Array,
  resolveGradient,
} from './decode';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';

describe('parsePackedFloat32Array', () => {
  it('parses a comma-separated float run', () => {
    expect(parsePackedFloat32Array('PackedFloat32Array(0, 0.642276, 1)')).toEqual([
      0, 0.642276, 1,
    ]);
  });

  it('reads the typed and bare spellings the slot converts', () => {
    // Gradient.offsets is PACKED_FLOAT32_ARRAY (gradient.cpp:80); a scalar
    // slot's bare and typed bodies are the same comma-separated numbers the
    // constructor's flat argument list holds.
    expect(parsePackedFloat32Array('Array[float]([0, 0.5, 1])')).toEqual([0, 0.5, 1]);
    expect(parsePackedFloat32Array('[0, 0.5, 1]')).toEqual([0, 0.5, 1]);
    expect(parsePackedFloat32Array('[]')).toEqual([]);
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

  it('refuses the spellings Godot cannot read, instead of taking a prefix', () => {
    // `parseFloat` read `1.2.3` as 1.2 and `0x10` as 0, and let `+1` / `.5`
    // through, all of which fail Godot's own tokenizer.
    for (const bad of ['1.2.3', '+1', '.5', '0x10']) {
      expect(() => parsePackedFloat32Array(`PackedFloat32Array(0, ${bad}, 1)`)).toThrow(
        'Invalid number in PackedFloat32Array'
      );
    }
  });

  it('refuses a non-finite offset, matching its packed siblings', () => {
    expect(() => parsePackedFloat32Array('PackedFloat32Array(0, inf, 1)')).toThrow(
      'Invalid number in PackedFloat32Array'
    );
  });
});

describe('parseColorStops', () => {
  it('groups the flat run into RGBA quadruples', () => {
    const colors = parseColorStops(
      'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)'
    );
    expect(colors).toEqual([
      { r: 1, g: 1, b: 1, a: 1 },
      { r: 1, g: 1, b: 1, a: 0.180392 },
      { r: 1, g: 1, b: 1, a: 0 },
    ]);
  });

  it('reads the typed and bare spellings, whose bodies hold Color() elements', () => {
    // `can_convert_strict` lists ARRAY as a valid source for PACKED_COLOR_ARRAY
    // (variant.cpp:467-473) and `Gradient::set_colors` (gradient.cpp:81) takes
    // the converted array, so both load. Reading only the constructor threw,
    // `safeColors` swallowed the throw, and the gradient sampled opaque black
    // with nothing reported.
    const expected = [
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
    ];
    expect(parseColorStops('[Color(1, 0, 0, 1), Color(0, 0, 1, 1)]')).toEqual(expected);
    expect(
      parseColorStops('Array[Color]([Color(1, 0, 0, 1), Color(0, 0, 1, 1)])')
    ).toEqual(expected);
    expect(parseColorStops('[]')).toEqual([]);
  });

  it('drops a trailing partial quadruple', () => {
    const colors = parseColorStops('PackedColorArray(1, 0, 0, 1, 0, 1)');
    expect(colors).toEqual([{ r: 1, g: 0, b: 0, a: 1 }]);
  });
});

describe('decodeGradient', () => {
  it('pairs offsets with colors into sorted stops (the coin gradient)', () => {
    const gradient = decodeGradient({
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
    const gradient = decodeGradient({
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0)',
    });

    expect(gradient.interpolationMode).toBe(GradientInterpolationMode.Linear);
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
  });

  it('sorts stops ascending by offset', () => {
    const gradient = decodeGradient({
      offsets: 'PackedFloat32Array(1, 0)',
      colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
    });
    expect(gradient.stops.map((s) => s.offset)).toEqual([0, 1]);
    expect(gradient.stops[0]!.color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('is empty (not throwing) for malformed arrays', () => {
    const gradient = decodeGradient({ colors: 'PackedColorArray(oops', offsets: 'garbage' });
    expect(gradient.stops).toEqual([]);
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
});

/** A two-stop ramp: opaque orange fading to transparent. */
const ORANGE_RAMP = {
  offsets: 'PackedFloat32Array(0, 1)',
  colors: 'PackedColorArray(1, 0.6, 0.2, 1, 1, 0.6, 0.2, 0)',
};

const RAMP_RESOURCE: TscnInternalResource = {
  type: 'Gradient',
  id: '1',
  data: { id: '3', ...ORANGE_RAMP },
};

describe('resolveGradient', () => {
  it('decodes the Gradient a SubResource reference names (happy path)', () => {
    const gradient = resolveGradient('SubResource("3")', [RAMP_RESOURCE]);
    expect(gradient?.stops).toHaveLength(2);
    expect(gradient?.stops[0]!.color).toEqual({ r: 1, g: 0.6, b: 0.2, a: 1 });
  });

  it('returns null when the reference names a different resource type (error path)', () => {
    const curve: TscnInternalResource = { type: 'Curve', id: '2', data: { id: '3' } };
    expect(resolveGradient('SubResource("3")', [curve])).toBeNull();
  });

  it('returns null for an absent or non-SubResource reference (edge case)', () => {
    expect(resolveGradient(undefined, [RAMP_RESOURCE])).toBeNull();
    expect(resolveGradient('ExtResource("3")', [RAMP_RESOURCE])).toBeNull();
    expect(resolveGradient('SubResource("nope")', [RAMP_RESOURCE])).toBeNull();
  });
});

/** The given properties as a standalone `.tres` file's `[resource]` body. */
function tresFile(type: string, properties: Record<string, string>): string {
  const body = Object.entries(properties)
    .map(([key, value]) => `${key} = ${value}`)
    .join('\n');
  return `[gd_resource type="${type}" format=3 uid="uid://cgrad00"]\n\n[resource]\n${body}\n`;
}

describe('gradientFromResource', () => {
  it('decodes a `.tres` body identically to the same properties arriving inline', () => {
    // One property set drives both arrival paths, so they cannot drift.
    const external = gradientFromResource(parseTresFile(tresFile('Gradient', ORANGE_RAMP)));
    const inline = resolveGradient('SubResource("3")', [RAMP_RESOURCE]);

    expect(external).toEqual(inline);
    expect(external?.stops).toHaveLength(2);
  });

  it('returns null for a resource file of some other type (error path)', () => {
    const parsed = parseTresFile(tresFile('Curve', { _data: '[Vector2(0, 0), 0.0, 0.0, 0, 0]' }));
    expect(gradientFromResource(parsed)).toBeNull();
  });

  it('decodes an empty `[resource]` body to a stopless gradient (edge case)', () => {
    const parsed = parseTresFile('[gd_resource type="Gradient" format=3]\n\n[resource]\n');
    expect(gradientFromResource(parsed)).toEqual({
      stops: [],
      interpolationMode: GradientInterpolationMode.Linear,
    });
  });
});
