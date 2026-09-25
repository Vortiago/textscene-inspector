/**
 * StandardMaterial3D clearcoat, which maps 1:1 onto `MeshPhysicalMaterial.clearcoat` and
 * `.clearcoatRoughness` (0 is no coat). Both are 0..1 and gated on `clearcoat_enabled`,
 * as Godot ignores them with the flag off.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars — clearcoat flag (WI-66)', () => {
  it('parses clearcoat + clearcoat_roughness when clearcoat_enabled is true', () => {
    // Explicit values, so the result holds whatever Godot's enabled-but-unset default.
    expect(
      parseStandardMaterial3DScalars({
        clearcoat_enabled: 'true',
        clearcoat: '0.7',
        clearcoat_roughness: '0.25',
      })
    ).toMatchObject({ clearcoat: 0.7, clearcoatRoughness: 0.25 });
  });

  it('enabled but strengths unset → Godot defaults (clearcoat 1, clearcoat_roughness 0.5)', () => {
    // A .tscn omits default-valued properties, so the flag often ships alone. Godot's
    // defaults are clearcoat 1.0 and clearcoat_roughness 0.5, not the off-state 0.
    expect(parseStandardMaterial3DScalars({ clearcoat_enabled: 'true' })).toMatchObject({
      clearcoat: 1,
      clearcoatRoughness: 0.5,
    });
  });

  it('clamps the enabled clearcoat strength to 0..1 (over-range → 1, negative → 0)', () => {
    // Strength is a 0..1 scalar; a stray out-of-range value must saturate, not
    // leak past the range into the renderer.
    expect(
      parseStandardMaterial3DScalars({ clearcoat_enabled: 'true', clearcoat: '2.5' }).clearcoat
    ).toBe(1);
    expect(
      parseStandardMaterial3DScalars({ clearcoat_enabled: 'true', clearcoat: '-1' }).clearcoat
    ).toBe(0);
  });

  it('gates on clearcoat_enabled — scalars present but the flag absent → no coat (0)', () => {
    // Godot applies clearcoat only when clearcoat_enabled is set, so without the flag
    // 0.7 must not reach the material.
    const r = parseStandardMaterial3DScalars({
      clearcoat: '0.7',
      clearcoat_roughness: '0.25',
    });
    expect(r.clearcoat).toBe(0);
    expect(r.clearcoatRoughness).toBe(0);
  });

  it('clearcoat defaults to 0 (no coat) when no clearcoat properties are present', () => {
    // The unset material and an explicit clearcoat_enabled=false
    // both resolve to no coat.
    expect(parseStandardMaterial3DScalars({}).clearcoat).toBe(0);
    expect(parseStandardMaterial3DScalars({ clearcoat_enabled: 'false' }).clearcoat).toBe(0);
  });

  it('does not suppress other scalar parsing when clearcoat is on', () => {
    // Enabling clearcoat must not short-circuit albedo / metal /
    // roughness parsing: every other scalar still flows through unchanged.
    const result = parseStandardMaterial3DScalars({
      clearcoat_enabled: 'true',
      clearcoat: '0.5',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    // Albedo went through the sRGB → linear conversion (so < the raw 0.8).
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
    expect(result.clearcoat).toBe(0.5);
  });
});
