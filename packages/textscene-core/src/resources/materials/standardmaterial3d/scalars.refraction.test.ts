/**
 * StandardMaterial3D refraction, parse layer, gated on `refraction_enabled`. Godot's
 * screen-space distortion maps in kind onto three's volumetric transmission: `transmission`
 * 1 at three's ior 1.5, and `refraction_scale` → `thickness`, at least 0. The per-pixel
 * `refraction_texture` has another channel meaning than `transmissionMap`, so it is unwired.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars — refraction flag (WI-69)', () => {
  it('parses transmission + thickness when refraction_enabled is true', () => {
    expect(
      parseStandardMaterial3DScalars({ refraction_enabled: 'true', refraction_scale: '0.2' })
    ).toMatchObject({ transmission: 1, refractionThickness: 0.2 });
  });

  it('enabled but scale unset → Godot default refraction_scale 0.05', () => {
    // A .tscn omits default-valued properties, so the flag often ships alone. Godot's
    // `refraction_scale` default is 0.05.
    expect(parseStandardMaterial3DScalars({ refraction_enabled: 'true' })).toMatchObject({
      transmission: 1,
      refractionThickness: 0.05,
    });
  });

  it('clamps a negative refraction_scale to 0 thickness (still transmissive)', () => {
    // Volumetric thickness cannot be negative; a stray negative distortion
    // strength must not leak a negative thickness into the renderer.
    expect(
      parseStandardMaterial3DScalars({ refraction_enabled: 'true', refraction_scale: '-0.3' })
    ).toMatchObject({ transmission: 1, refractionThickness: 0 });
  });

  it('gates on refraction_enabled — scale present but the flag absent → opaque (0)', () => {
    // Godot applies refraction only when refraction_enabled is set, so without the
    // flag the material must not turn transmissive.
    expect(
      parseStandardMaterial3DScalars({ refraction_scale: '0.2' })
    ).toMatchObject({ transmission: 0, refractionThickness: 0 });
  });

  it('refraction defaults to off (opaque) when no refraction properties are present', () => {
    // The unset material and an explicit refraction_enabled=false both
    // resolve to non-transmissive (no refraction).
    expect(parseStandardMaterial3DScalars({})).toMatchObject({
      transmission: 0,
      refractionThickness: 0,
    });
    expect(
      parseStandardMaterial3DScalars({ refraction_enabled: 'false', refraction_scale: '0.2' })
    ).toMatchObject({ transmission: 0, refractionThickness: 0 });
  });

  it('does not suppress other scalar parsing when refraction is on', () => {
    // Enabling refraction must not short-circuit albedo / metal /
    // roughness parsing: every other scalar still flows through unchanged.
    const result = parseStandardMaterial3DScalars({
      refraction_enabled: 'true',
      refraction_scale: '0.1',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    expect(result).toMatchObject({ transmission: 1, refractionThickness: 0.1 });
    // Albedo went through the sRGB → linear conversion (so < the raw 0.8).
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
  });
});
