/**
 * StandardMaterial3D anisotropy, parse layer. Godot's −1..1 `anisotropy` carries the
 * tangent direction in its sign, which maps to three's 0..1 magnitude and a 0 or π/2
 * `anisotropyRotation`, gated on `anisotropy_enabled`. The flowmap's render contract
 * lives in Component.material-anisotropy.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

const HALF_PI = Math.PI / 2;

describe('parseStandardMaterial3DScalars — anisotropy flag (WI-68)', () => {
  it('parses a positive anisotropy strength with no rotation when enabled', () => {
    // A positive value → magnitude straight through, direction unrotated (0).
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '0.8' })
    ).toMatchObject({ anisotropy: 0.8, anisotropyRotation: 0 });
  });

  it('maps a negative anisotropy to magnitude + a 90° perpendicular rotation', () => {
    // A negative value keeps its strength (|−0.8| → 0.8) and turns the highlight
    // perpendicular, which three.js expresses as a π/2 rotation.
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '-0.8' })
    ).toMatchObject({ anisotropy: 0.8, anisotropyRotation: expect.closeTo(HALF_PI, 5) });
  });

  it('enabled but strength unset → Godot default (anisotropy 0.0, no rotation)', () => {
    // A .tscn omits default-valued properties. Godot's `anisotropy` default is 0.0,
    // unlike clearcoat (1.0) and rim (1.0), so the flag alone shows no effect.
    expect(parseStandardMaterial3DScalars({ anisotropy_enabled: 'true' })).toMatchObject({
      anisotropy: 0,
      anisotropyRotation: 0,
    });
  });

  it('clamps the enabled anisotropy magnitude to 0..1 (over-range saturates to 1), preserving direction', () => {
    // The three.js `anisotropy` magnitude saturates at 1. The sign still drives rotation:
    // +2.5 → magnitude 1, no rotation; −2.5 → magnitude 1, perpendicular.
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '2.5' })
    ).toMatchObject({ anisotropy: 1, anisotropyRotation: 0 });
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '-2.5' })
    ).toMatchObject({ anisotropy: 1, anisotropyRotation: expect.closeTo(HALF_PI, 5) });
  });

  it('gates on anisotropy_enabled — strength present but the flag absent → isotropic (0), no rotation', () => {
    // Godot applies anisotropy only when anisotropy_enabled is set, so without the
    // flag 0.8 must not reach the material.
    expect(parseStandardMaterial3DScalars({ anisotropy: '-0.8' })).toMatchObject({
      anisotropy: 0,
      anisotropyRotation: 0,
    });
  });

  it('anisotropy defaults to 0 (isotropic) when no anisotropy properties are present', () => {
    // The unset material and an explicit anisotropy_enabled=false both
    // resolve to isotropic (no anisotropy, no rotation).
    expect(parseStandardMaterial3DScalars({})).toMatchObject({ anisotropy: 0, anisotropyRotation: 0 });
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'false', anisotropy: '0.8' })
    ).toMatchObject({ anisotropy: 0, anisotropyRotation: 0 });
  });

  it('does not suppress other scalar parsing when anisotropy is on', () => {
    // Enabling anisotropy must not short-circuit albedo / metal /
    // roughness parsing: every other scalar still flows through unchanged.
    const result = parseStandardMaterial3DScalars({
      anisotropy_enabled: 'true',
      anisotropy: '0.5',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    expect(result).toMatchObject({ anisotropy: 0.5, anisotropyRotation: 0 });
    // Albedo went through the sRGB → linear conversion (so < the raw 0.8).
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
  });
});
