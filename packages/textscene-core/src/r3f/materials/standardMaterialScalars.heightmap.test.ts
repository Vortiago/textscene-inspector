/**
 * StandardMaterial3D height mapping handling.
 *
 * Godot's BaseMaterial3D exposes a height-mapping / parallax feature
 * (FEATURE_HEIGHT_MAPPING) behind a `heightmap_enabled` flag, with a
 * `heightmap_scale` depth scalar (default 5.0). The render side maps it to
 * three.js `MeshStandardMaterial.displacementScale` + a `displacementMap` (the
 * `heightmap_texture`) — a vertex-displacement approximation of Godot's
 * texture-space parallax.
 *
 * Unlike clearcoat/rim, `heightmap_scale` is a SCALE FACTOR, NOT a 0..1 value:
 * it may exceed 1 and may be negative (inverting the displacement), so the
 * parse must NOT clamp it. Gated on `heightmap_enabled`: off → 0 (no
 * displacement). The enabled-but-unset Godot default (5.0) is PINNED — it is
 * the common .tscn input, since Godot omits default-valued properties.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './standardMaterialScalars';

describe('parseStandardMaterial3DScalars — height mapping flag', () => {
  it('parses heightmap_scale when heightmap_enabled is true', () => {
    expect(
      parseStandardMaterial3DScalars({ heightmap_enabled: 'true', heightmap_scale: '3' }).heightmapScale
    ).toBe(3);
  });

  it('uses the Godot default (5.0) when heightmap_enabled is true but the scale is omitted', () => {
    // Flag-on + scale-absent is the COMMON .tscn input and must resolve to
    // Godot's enabled default (5.0), NOT 0.
    expect(parseStandardMaterial3DScalars({ heightmap_enabled: 'true' }).heightmapScale).toBe(5.0);
  });

  it('does NOT clamp the scale — values >1 and negative pass through', () => {
    // DISCRIMINATOR: heightmap_scale is a depth scale, not a 0..1 factor.
    // A clamp01 (correct for clearcoat/rim) would be WRONG here.
    expect(
      parseStandardMaterial3DScalars({ heightmap_enabled: 'true', heightmap_scale: '10' }).heightmapScale
    ).toBe(10);
    expect(
      parseStandardMaterial3DScalars({ heightmap_enabled: 'true', heightmap_scale: '-2' }).heightmapScale
    ).toBe(-2);
  });

  it('gates on heightmap_enabled — a scale present but the flag absent → 0', () => {
    expect(parseStandardMaterial3DScalars({ heightmap_scale: '5' }).heightmapScale).toBe(0);
  });

  it('heightmapScale defaults to 0 (no displacement) when disabled or absent', () => {
    expect(parseStandardMaterial3DScalars({}).heightmapScale).toBe(0);
    expect(parseStandardMaterial3DScalars({ heightmap_enabled: 'false' }).heightmapScale).toBe(0);
  });

  it('does not suppress other scalar parsing when heightmap is on', () => {
    const result = parseStandardMaterial3DScalars({
      heightmap_enabled: 'true',
      heightmap_scale: '4',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
    expect(result.heightmapScale).toBe(4);
  });
});
