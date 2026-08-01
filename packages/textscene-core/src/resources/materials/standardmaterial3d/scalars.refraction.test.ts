/**
 * StandardMaterial3D refraction handling — parse layer.
 *
 * Godot's BaseMaterial3D refraction feature bends the view of whatever is
 * behind a (semi-)transparent surface, behind a `refraction_enabled` flag with
 * a `refraction_scale` strength (default 0.05) and a `refraction_texture`.
 *
 * PARITY (documented up front — the mapping is faithful in KIND, not 1:1):
 * Godot refraction is a SCREEN-SPACE distortion of the background scaled by
 * `refraction_scale`; three.js has no screen-space refraction, but its
 * MeshPhysicalMaterial models the same "see the refracted background through
 * this surface" effect VOLUMETRICALLY via `transmission` + `ior` + `thickness`.
 * So this slice maps:
 *   - `refraction_enabled` → `transmission` = 1 (fully transmissive) + the
 *     material's index of refraction stays at three's glass default (ior 1.5;
 *     Godot exposes no ior), and
 *   - `refraction_scale` → `thickness` (a thicker volume bends light more —
 *     directionally the same knob as Godot's distortion strength), clamped ≥ 0.
 * The EXACT distortion differs (screen-space vs volumetric), and the
 * `refraction_texture` / `refraction_texture_channel` (per-pixel refraction
 * strength — a different channel semantic than three's transmissionMap) are a
 * documented follow-up, NOT in this contract. Same shape as the heightmap
 * depth-space limitation and the anisotropy flowmap-texture deferral.
 *
 * The scalars are GATED on `refraction_enabled` (mirroring clearcoat/rim/
 * anisotropy): with the flag off, Godot ignores the properties, so the parse
 * yields the non-refractive zero rather than leak transmission onto an opaque
 * material the author never enabled refraction for.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars — refraction flag (WI-69)', () => {
  it('parses transmission + thickness when refraction_enabled is true', () => {
    // DISCRIMINATOR (RED at base): the returned scalars carry no transmission /
    // refractionThickness fields today, so toMatchObject fails at runtime.
    expect(
      parseStandardMaterial3DScalars({ refraction_enabled: 'true', refraction_scale: '0.2' })
    ).toMatchObject({ transmission: 1, refractionThickness: 0.2 });
  });

  it('enabled but scale unset → Godot default refraction_scale 0.05', () => {
    // COMMON REAL-WORLD INPUT: .tscn omits default-valued properties. Godot's
    // BaseMaterial3D `refraction_scale` default is 0.05 (docs.godotengine.org),
    // so a refraction-enabled material usually ships the flag alone. Pin the
    // documented default so a hallucinated fallback can't slip in.
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
    // GUARDRAIL (load-bearing): Godot applies refraction only when
    // refraction_enabled is set. A raw parse that skips the flag gate would turn
    // a material the author never enabled refraction for transmissive — the
    // exact harm. Mirrors the clearcoat_enabled / rim_enabled / anisotropy gates.
    expect(
      parseStandardMaterial3DScalars({ refraction_scale: '0.2' })
    ).toMatchObject({ transmission: 0, refractionThickness: 0 });
  });

  it('refraction defaults to off (opaque) when no refraction properties are present', () => {
    // GUARDRAIL: the unset material and an explicit refraction_enabled=false both
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
    // GUARDRAIL: enabling refraction must NOT short-circuit albedo / metal /
    // roughness parsing — every other scalar still flows through unchanged.
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
