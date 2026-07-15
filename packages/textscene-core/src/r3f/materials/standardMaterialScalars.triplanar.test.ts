/**
 * StandardMaterial3D triplanar handling.
 *
 * Godot's `uv1_triplanar` (+ `uv1_world_triplanar`) project the albedo /
 * normal / etc. texture from world (or object) axes and tile it once per
 * world unit × `uv1_scale`, independent of the mesh's own UVs. We don't run a
 * triplanar shader; the scalar parse exposes a boolean `triplanar` flag so the
 * consumer (MeshInstance3D) can reproduce the tiling DENSITY for the planar
 * meshes that dominate level geometry (floors/walls/ceilings) — see
 * `triplanarPlaneScale`. Without the flag the floor/ceiling textures rendered
 * stretched once across the whole plane ("too big").
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './standardMaterialScalars';

describe('parseStandardMaterial3DScalars — triplanar flag (WI-HALL-5)', () => {
  it('sets triplanar=true when uv1_triplanar is on', () => {
    expect(parseStandardMaterial3DScalars({ uv1_triplanar: 'true' }).triplanar).toBe(true);
  });

  it('sets triplanar=true when uv1_world_triplanar is on alone (no uv1_triplanar)', () => {
    expect(parseStandardMaterial3DScalars({ uv1_world_triplanar: 'true' }).triplanar).toBe(true);
  });

  it('triplanar defaults to false when neither flag is present or true', () => {
    expect(parseStandardMaterial3DScalars({}).triplanar).toBe(false);
    expect(parseStandardMaterial3DScalars({ uv1_triplanar: 'false' }).triplanar).toBe(false);
  });

  it('does not suppress other scalar parsing when triplanar is on', () => {
    // Load-bearing: the triplanar flag must NOT short-circuit albedo/metal/
    // roughness parsing — the texture binding still flows through useResource.
    const result = parseStandardMaterial3DScalars({
      uv1_triplanar: 'true',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    // Albedo went through the sRGB → linear conversion.
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
    expect(result.triplanar).toBe(true);
  });
});
