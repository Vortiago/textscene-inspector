/**
 * Tests that the legacy TileMap draws each enabled layer's cells in order. Godot adds each layer
 * as an internal TileMapLayer child at the front (`scene/2d/tile_map.cpp:277-279`), so the layers
 * draw before the TileMap's authored children, and a layer's `z_index` is its own.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isInZBucket, nearestGroupOrder } from '../../../../r3f/testing/paintOrder';
import { polygonMeshes, renderTileMap, tileMeshes } from './tileMap.testkit';

const withTileSet = (...lines: string[]) => ['tile_set = SubResource("ts")', ...lines].join('\n');

describe('TileMap render parity', () => {
  it('renders enabled layers in order with the layer z rule; disabled layers are skipped', async () => {
    const renderer = await renderTileMap(
      withTileSet(
        'layer_0/tile_data = PackedInt32Array(0, 0, 0)',
        'layer_1/z_index = 1',
        'layer_1/tile_data = PackedInt32Array(1, 0, 0)',
        'layer_2/enabled = false',
        'layer_2/tile_data = PackedInt32Array(2, 0, 0)'
      )
    );
    const [layer0, layer1] = tileMeshes(renderer).map(nearestGroupOrder);
    expect(tileMeshes(renderer)).toHaveLength(2);
    expect(layer0).toBeLessThan(layer1!);
    expect(isInZBucket(layer0!, 0)).toBe(true);
    expect(isInZBucket(layer1!, 1)).toBe(true);
  });

  it("draws every layer before the TileMap's authored child, and that before the next sibling", async () => {
    const renderer = await renderTileMap(
      withTileSet(
        'layer_0/tile_data = PackedInt32Array(0, 0, 0)',
        'layer_1/tile_data = PackedInt32Array(1, 0, 0)',
        'layer_2/tile_data = PackedInt32Array(2, 0, 0)'
      )
    );
    const layers = tileMeshes(renderer).map(nearestGroupOrder);
    const [child, after] = polygonMeshes(renderer).map(nearestGroupOrder);
    expect(layers).toHaveLength(3);
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
    expect(Math.max(...layers)).toBeLessThan(child!);
    expect(child).toBeLessThan(after!);
  });

  it('gives each row of a y-sorted layer its own draw value under a TileMap that sorts nothing', async () => {
    const renderer = await renderTileMap(
      withTileSet(
        'layer_0/y_sort_enabled = true',
        'layer_0/tile_data = PackedInt32Array(0, 0, 0, 65536, 0, 0, 131072, 0, 0)'
      )
    );
    const rows = tileMeshes(renderer).map(nearestGroupOrder);
    expect(rows).toHaveLength(3);
    expect(new Set(rows).size).toBe(3);
    const [child] = polygonMeshes(renderer).map(nearestGroupOrder);
    expect(Math.max(...rows)).toBeLessThan(child!);
  });

  it('draws no tile for a TileMap with a tile_set but zero layers', async () => {
    const renderer = await renderTileMap(withTileSet());
    expect(tileMeshes(renderer)).toHaveLength(0);
  });

  it("applies layer_N/modulate to that layer's pixels (composed in sRGB, like the CanvasItem chain)", async () => {
    const renderer = await renderTileMap(
      withTileSet(
        'layer_0/tile_data = PackedInt32Array(0, 0, 0)',
        'layer_0/modulate = Color(0.5, 0.5, 0.5, 0.5)'
      )
    );
    const material = tileMeshes(renderer)[0]!.material as THREE.MeshBasicMaterial;
    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
    expect(material.opacity).toBeCloseTo(0.5, 5);
  });
});
