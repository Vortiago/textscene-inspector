/**
 * StandardMaterial3D height mapping, which the render side draws as Godot's parallax shift of the
 * texture coordinates. `heightmap_scale` is a depth factor that may exceed 1 or be negative, so it
 * passes unclamped.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

const heightmapOf = (properties: Record<string, string>) =>
  parseStandardMaterial3DScalars(properties).heightmap;

describe('parseStandardMaterial3DScalars: height mapping', () => {
  it("reads Godot's defaults when only heightmap_enabled is set", () => {
    expect(heightmapOf({ heightmap_enabled: 'true' })).toEqual({
      scale: 5,
      isDeep: false,
      layers: [8, 32],
      flip: [1, 1],
      readsHeight: false,
    });
  });

  it('reads the deep parallax layers, the flips and the inverted texture', () => {
    expect(
      heightmapOf({
        heightmap_enabled: 'true',
        heightmap_deep_parallax: 'true',
        heightmap_min_layers: '4',
        heightmap_max_layers: '16',
        heightmap_flip_tangent: 'true',
        heightmap_flip_binormal: 'true',
        heightmap_flip_texture: 'true',
      })
    ).toEqual({ scale: 5, isDeep: true, layers: [4, 16], flip: [-1, -1], readsHeight: true });
  });

  it('passes a scale above 1 or below 0 unclamped (edge case)', () => {
    expect(heightmapOf({ heightmap_enabled: 'true', heightmap_scale: '10' })?.scale).toBe(10);
    expect(heightmapOf({ heightmap_enabled: 'true', heightmap_scale: '-2' })?.scale).toBe(-2);
  });

  it('has no height mapping without heightmap_enabled', () => {
    expect(heightmapOf({ heightmap_scale: '5' })).toBeNull();
    expect(heightmapOf({ heightmap_enabled: 'false' })).toBeNull();
  });

  it('has no height mapping under triplanar mapping, which overrides it (edge case)', () => {
    expect(heightmapOf({ heightmap_enabled: 'true', uv1_triplanar: 'true' })).toBeNull();
  });
});
