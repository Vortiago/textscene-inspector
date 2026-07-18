/**
 * StandardMaterial3D rim lighting handling.
 *
 * Godot's BaseMaterial3D exposes a rim-lighting feature — a Fresnel edge
 * highlight — behind a `rim_enabled` flag, with a `rim` strength scalar
 * (0..1, default 1.0) and a `rim_tint` scalar (0..1, default 0.5, blending the
 * highlight between the light colour and the albedo). three.js
 * `MeshStandardMaterial` has NO native rim property; the render side maps it to
 * `MeshPhysicalMaterial.sheen` (a Fresnel edge highlight, the closest native
 * analog). This parse exposes the scalars so that wiring has faithful values.
 *
 * Like `emission_enabled` / the sibling clearcoat feature, the rim scalars are
 * GATED on `rim_enabled`: with the flag off, Godot ignores the properties, so
 * the parse yields 0 (no rim). Following the clearcoat lesson, this
 * contract PINS the enabled-but-unset Godot defaults (the COMMON .tscn input,
 * since Godot omits default-valued properties) so no later refactor can
 * silently regress them, plus the clamp and the flag-gate guardrail.
 *
 * Godot defaults (docs.godotengine.org BaseMaterial3D): rim 1.0, rim_tint 0.5.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './standardMaterialScalars';

describe('parseStandardMaterial3DScalars — rim lighting flag (WI-67)', () => {
  it('parses rim + rim_tint when rim_enabled is true', () => {
    expect(
      parseStandardMaterial3DScalars({
        rim_enabled: 'true',
        rim: '0.7',
        rim_tint: '0.25',
      })
    ).toMatchObject({ rim: 0.7, rimTint: 0.25 });
  });

  it('uses Godot defaults when rim_enabled is true but the scalars are omitted', () => {
    // Clearcoat taught this: flag-on + scalars-absent is the COMMON .tscn input and must
    // resolve to Godot's enabled defaults (rim 1.0 / rim_tint 0.5), NOT 0.
    const r = parseStandardMaterial3DScalars({ rim_enabled: 'true' });
    expect(r.rim).toBe(1.0);
    expect(r.rimTint).toBe(0.5);
  });

  it('gates on rim_enabled — scalars present but the flag absent → no rim (0)', () => {
    const r = parseStandardMaterial3DScalars({ rim: '0.7', rim_tint: '0.25' });
    expect(r.rim).toBe(0);
    expect(r.rimTint).toBe(0);
  });

  it('rim defaults to 0 (no rim) when disabled or absent', () => {
    expect(parseStandardMaterial3DScalars({}).rim).toBe(0);
    expect(parseStandardMaterial3DScalars({ rim_enabled: 'false' }).rim).toBe(0);
  });

  it('clamps the enabled rim + rim_tint to 0..1', () => {
    const over = parseStandardMaterial3DScalars({
      rim_enabled: 'true',
      rim: '2.5',
      rim_tint: '1.5',
    });
    expect(over.rim).toBe(1);
    expect(over.rimTint).toBe(1);
    const under = parseStandardMaterial3DScalars({
      rim_enabled: 'true',
      rim: '-1',
      rim_tint: '-0.5',
    });
    expect(under.rim).toBe(0);
    expect(under.rimTint).toBe(0);
  });

  it('does not suppress other scalar parsing when rim is on', () => {
    const result = parseStandardMaterial3DScalars({
      rim_enabled: 'true',
      rim: '0.5',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
    expect(result.rim).toBe(0.5);
  });
});
