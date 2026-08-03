/**
 * StandardMaterial3D anisotropy handling — parse layer.
 *
 * Godot's BaseMaterial3D anisotropy feature stretches the specular highlight
 * along tangent space (brushed metal, hair), behind an `anisotropy_enabled`
 * flag, with an `anisotropy` strength scalar and an `anisotropy_flowmap`
 * texture. three.js models the same effect natively on `MeshPhysicalMaterial`:
 * `anisotropy` (0..1 magnitude, default 0 = isotropic), `anisotropyRotation`
 * (direction, radians), and `anisotropyMap` (per-pixel direction+strength).
 *
 * Godot's `anisotropy` scalar is −1..1 where the SIGN encodes tangent
 * DIRECTION (a negative value rotates the highlight 90° perpendicular).
 * three.js splits that into a 0..1 `anisotropy` MAGNITUDE plus an
 * `anisotropyRotation`. This parse layer maps BOTH:
 *   - strength → `anisotropy` = |value| clamped to 0..1 (so a negative value
 *     keeps its effect STRENGTH instead of silently vanishing), and
 *   - direction → `anisotropyRotation` = 0 for a positive value, π/2 (90°,
 *     perpendicular) for a negative one — the documented sign→direction mapping.
 * (The `anisotropy_flowmap` texture is a resource-loading concern handled in the
 * node Component, not here; its render contract lives in Component.material-anisotropy.test.tsx.)
 *
 * Like `clearcoat_enabled` / `rim_enabled` gate their scalars, both anisotropy
 * scalars are GATED on `anisotropy_enabled`: with the flag off, Godot ignores
 * the properties, so the parse must yield the isotropic zero rather than leak a
 * stray strength/rotation onto a material the author never enabled it for.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

const HALF_PI = Math.PI / 2;

describe('parseStandardMaterial3DScalars — anisotropy flag (WI-68)', () => {
  it('parses a positive anisotropy strength with no rotation when enabled', () => {
    // DISCRIMINATOR (RED at base): the returned scalars carry no `anisotropy` /
    // `anisotropyRotation` fields today, so toMatchObject fails at runtime. A
    // positive value → magnitude straight through, direction unrotated (0).
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '0.8' })
    ).toMatchObject({ anisotropy: 0.8, anisotropyRotation: 0 });
  });

  it('maps a negative anisotropy to magnitude + a 90° perpendicular rotation', () => {
    // Godot anisotropy is −1..1; the SIGN carries direction. A negative value
    // must keep its STRENGTH (|−0.8| → 0.8, never silently isotropic) AND flip
    // the highlight perpendicular — three.js expresses that as a π/2 rotation.
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '-0.8' })
    ).toMatchObject({ anisotropy: 0.8, anisotropyRotation: expect.closeTo(HALF_PI, 5) });
  });

  it('enabled but strength unset → Godot default (anisotropy 0.0, no rotation)', () => {
    // COMMON REAL-WORLD INPUT: .tscn omits default-valued properties. Godot's
    // BaseMaterial3D `anisotropy` default is 0.0 (docs.godotengine.org) — unlike
    // clearcoat (1.0) / rim (1.0), the anisotropy default is the isotropic zero,
    // so enabling the feature without a strength shows no effect. Pin the
    // documented default so a hallucinated non-zero fallback can't slip in.
    expect(parseStandardMaterial3DScalars({ anisotropy_enabled: 'true' })).toMatchObject({
      anisotropy: 0,
      anisotropyRotation: 0,
    });
  });

  it('clamps the enabled anisotropy magnitude to 0..1 (over-range saturates to 1), preserving direction', () => {
    // The three.js `anisotropy` magnitude saturates at 1; a stray out-of-range
    // Godot value must not leak past the range. The SIGN still drives rotation:
    // +2.5 → magnitude 1, no rotation; −2.5 → magnitude 1, perpendicular.
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '2.5' })
    ).toMatchObject({ anisotropy: 1, anisotropyRotation: 0 });
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '-2.5' })
    ).toMatchObject({ anisotropy: 1, anisotropyRotation: expect.closeTo(HALF_PI, 5) });
  });

  it('gates on anisotropy_enabled — strength present but the flag absent → isotropic (0), no rotation', () => {
    // GUARDRAIL (load-bearing): Godot applies anisotropy only when
    // anisotropy_enabled is set. A raw parse that skips the flag gate would leak
    // 0.8 onto a material the author never enabled anisotropy for — the exact
    // harm. Mirrors the clearcoat_enabled / rim_enabled gates.
    expect(parseStandardMaterial3DScalars({ anisotropy: '-0.8' })).toMatchObject({
      anisotropy: 0,
      anisotropyRotation: 0,
    });
  });

  it('anisotropy defaults to 0 (isotropic) when no anisotropy properties are present', () => {
    // GUARDRAIL: the unset material and an explicit anisotropy_enabled=false both
    // resolve to isotropic (no anisotropy, no rotation).
    expect(parseStandardMaterial3DScalars({})).toMatchObject({ anisotropy: 0, anisotropyRotation: 0 });
    expect(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'false', anisotropy: '0.8' })
    ).toMatchObject({ anisotropy: 0, anisotropyRotation: 0 });
  });

  it('does not suppress other scalar parsing when anisotropy is on', () => {
    // GUARDRAIL: enabling anisotropy must NOT short-circuit albedo / metal /
    // roughness parsing — every other scalar still flows through unchanged.
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
