/**
 * StandardMaterial3D height mapping, which the render side approximates with
 * `displacementScale` and a `displacementMap`. `heightmap_scale` is a scale factor, not
 * 0..1: it may exceed 1 or be negative, so it is not clamped. Gated on
 * `heightmap_enabled`, with Godot's default 5.0 when omitted.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars — height mapping flag', () => {
  it('parses heightmap_scale when heightmap_enabled is true', () => {
    expect(
      parseStandardMaterial3DScalars({ heightmap_enabled: 'true', heightmap_scale: '3' }).heightmapScale
    ).toBe(3);
  });

  it('uses the Godot default (5.0) when heightmap_enabled is true but the scale is omitted', () => {
    // Flag-on and scale-absent is the common .tscn input and must resolve to
    // Godot's enabled default (5.0), not 0.
    expect(parseStandardMaterial3DScalars({ heightmap_enabled: 'true' }).heightmapScale).toBe(5.0);
  });

  it('does NOT clamp the scale — values >1 and negative pass through', () => {
    // heightmap_scale is a depth scale, not a 0..1 factor.
    // A clamp01, correct for clearcoat and rim, would be wrong here.
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
