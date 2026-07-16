/**
 * StandardMaterial3D clearcoat handling (WI-66).
 *
 * Godot's BaseMaterial3D exposes a clear-coat feature — a thin glossy layer
 * over the base surface — behind a `clearcoat_enabled` flag, with a
 * `clearcoat` strength scalar (0..1) and a `clearcoat_roughness` scalar
 * (0..1). three.js models the same effect natively via
 * `MeshPhysicalMaterial.clearcoat` / `.clearcoatRoughness` (both default 0 =
 * no coat), so the parsed strength maps across 1:1.
 *
 * Like `emission_enabled` gates the emissive value (→ 0x000000 when off), the
 * clearcoat scalar is GATED on `clearcoat_enabled`: with the flag off, Godot
 * ignores the property, so the parse must yield 0 (no coat) rather than leak a
 * stray strength that would paint gloss onto a material the author never
 * enabled it for. This file pins the strength round-trip when enabled, the
 * flag-gating (the load-bearing guardrail), and non-interference with the
 * other scalars. The render-side wiring into the material is out-of-gate
 * (verified by code-review), as is the enabled-but-unset Godot default.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './standardMaterialScalars';

describe('parseStandardMaterial3DScalars — clearcoat flag (WI-66)', () => {
  it('parses clearcoat + clearcoat_roughness when clearcoat_enabled is true', () => {
    // DISCRIMINATOR (RED at base): the returned scalars carry no clearcoat
    // fields today, so both reads are undefined. Explicit values, so the
    // result is correct regardless of Godot's enabled-but-unset default.
    expect(
      parseStandardMaterial3DScalars({
        clearcoat_enabled: 'true',
        clearcoat: '0.7',
        clearcoat_roughness: '0.25',
      })
    ).toMatchObject({ clearcoat: 0.7, clearcoatRoughness: 0.25 });
  });

  it('gates on clearcoat_enabled — scalars present but the flag absent → no coat (0)', () => {
    // GUARDRAIL (load-bearing): Godot applies clearcoat only when
    // clearcoat_enabled is set. A raw parse that skips the flag gate would
    // leak 0.7 onto a material the author never enabled clearcoat for — the
    // exact harm. Mirrors the emission_enabled → emissive gate.
    const r = parseStandardMaterial3DScalars({
      clearcoat: '0.7',
      clearcoat_roughness: '0.25',
    });
    expect(r.clearcoat).toBe(0);
    expect(r.clearcoatRoughness).toBe(0);
  });

  it('clearcoat defaults to 0 (no coat) when no clearcoat properties are present', () => {
    // GUARDRAIL: the unset material and an explicit clearcoat_enabled=false
    // both resolve to no coat.
    expect(parseStandardMaterial3DScalars({}).clearcoat).toBe(0);
    expect(parseStandardMaterial3DScalars({ clearcoat_enabled: 'false' }).clearcoat).toBe(0);
  });

  it('does not suppress other scalar parsing when clearcoat is on', () => {
    // GUARDRAIL: enabling clearcoat must NOT short-circuit albedo / metal /
    // roughness parsing — every other scalar still flows through unchanged.
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
