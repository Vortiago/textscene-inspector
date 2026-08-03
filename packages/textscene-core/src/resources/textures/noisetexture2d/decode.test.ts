/**
 * NoiseTexture2D decode: Godot's defaults, and the refs kept raw for the
 * resolver to look up in the owning file's table.
 */
import { describe, expect, it } from 'vitest';
import { decodeNoiseTexture2D } from './decode';

describe('decodeNoiseTexture2D', () => {
  it('applies Godot\'s defaults to an empty resource', () => {
    // noise_texture_2d.h:47-62 (size = 512x512 at line 54).
    expect(decodeNoiseTexture2D({})).toEqual({
      width: 512,
      height: 512,
      invert: false,
      normalize: true,
      seamless: false,
      seamlessBlendSkirt: 0.1,
      asNormalMap: false,
      bumpStrength: 8,
      noise: null,
      colorRamp: null,
    });
  });

  it('reads the ice.tres albedo texture', () => {
    expect(
      decodeNoiseTexture2D({
        width: '1024',
        height: '1024',
        noise: 'SubResource("FastNoiseLite_qbhty")',
        color_ramp: 'SubResource("Gradient_16ij7")',
        seamless: 'true',
      })
    ).toMatchObject({
      width: 1024,
      height: 1024,
      seamless: true,
      noise: 'SubResource("FastNoiseLite_qbhty")',
      colorRamp: 'SubResource("Gradient_16ij7")',
      // Untouched by that resource, so still Godot's defaults.
      normalize: true,
      asNormalMap: false,
      bumpStrength: 8,
    });
  });

  it('reads the ice.tres normal texture', () => {
    expect(
      decodeNoiseTexture2D({
        width: '1024',
        height: '1024',
        noise: 'SubResource("FastNoiseLite_5tmlw")',
        seamless: 'true',
        as_normal_map: 'true',
        bump_strength: '4.0',
      })
    ).toMatchObject({ asNormalMap: true, bumpStrength: 4, colorRamp: null });
  });

  it('reads invert, normalize and the blend skirt', () => {
    expect(
      decodeNoiseTexture2D({ invert: 'true', normalize: 'false', seamless_blend_skirt: '0.25' })
    ).toMatchObject({ invert: true, normalize: false, seamlessBlendSkirt: 0.25 });
  });

  it('falls back rather than storing NaN for malformed scalars', () => {
    const decoded = decodeNoiseTexture2D({ width: 'garbage', bump_strength: 'garbage' });
    expect(decoded.width).toBe(512);
    expect(decoded.bumpStrength).toBe(8);
  });

});
