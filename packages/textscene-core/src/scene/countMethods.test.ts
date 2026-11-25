import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { CallResult } from './nodeMethods';

// The TileMapLayer's fourth cell repeats (2, 0), and layer_0's third cell repeats (2, 0).
const COUNTS = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_map_data = PackedByteArray(0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0)

[node name="Empty" type="TileMapLayer" parent="."]

[node name="Map" type="TileMap" parent="."]
format = 2
layer_0/tile_data = PackedInt32Array(2, 0, 0, 0, 0, 0, 2, 65536, 0)
layer_2/tile_data = PackedInt32Array(65535, 0, 0)

[node name="Plain" type="TileMap" parent="."]

[node name="Skeleton" type="Skeleton3D" parent="."]
bones/0/name = "a"
bones/1/name = "b"
bones/1/parent = 0

[node name="Bare" type="Skeleton3D" parent="."]
`;

function openCounts(): Scene {
  return openScene({
    source: COUNTS,
    rootScenePath: 'res://counts.tscn',
    provider: { loadResource: async () => null },
  });
}

function textOf(value: CallResult): string {
  return value !== null && typeof value === 'object' && 'text' in value ? value.text : JSON.stringify(value);
}

// Each answer is what Godot 4.6.3 gives for the same scene (measured).
describe('the counts a script reads of tiles and bones', () => {
  it('lists a TileMapLayer cell set twice once, in its first place', async () => {
    const cells = await openCounts().getNode('Layer').call('get_used_cells');
    expect(textOf(cells)).toBe('Array[Vector2i]([Vector2i(2, 0), Vector2i(0, 0), Vector2i(-1, 3)])');
  });

  it('lists no cell of a TileMapLayer with no tile_map_data', async () => {
    expect(textOf(await openCounts().getNode('Empty').call('get_used_cells'))).toBe('Array[Vector2i]([])');
  });

  it('counts the gap layers a TileMap builds up to its last written layer', async () => {
    expect(await openCounts().getNode('Map').call('get_layers_count')).toBe(3);
  });

  it('counts the one layer a TileMap holds with none written', async () => {
    expect(await openCounts().getNode('Plain').call('get_layers_count')).toBe(1);
  });

  it('lists each layer of a TileMap, a negative index from the last', async () => {
    const map = openCounts().getNode('Map');
    const used = async (layer: number) => textOf(await map.call('get_used_cells', layer));
    expect(await used(0)).toBe('Array[Vector2i]([Vector2i(2, 0), Vector2i(0, 0)])');
    expect(await used(1)).toBe('Array[Vector2i]([])');
    expect(await used(2)).toBe('Array[Vector2i]([Vector2i(-1, 0)])');
    expect(await used(-1)).toBe('Array[Vector2i]([Vector2i(-1, 0)])');
  });

  it('lists no cell for a TileMap layer past the last', async () => {
    expect(textOf(await openCounts().getNode('Map').call('get_used_cells', 3))).toBe('Array[Vector2i]([])');
  });

  it('counts the bones a Skeleton3D file sets', async () => {
    const scene = openCounts();
    expect(await scene.getNode('Skeleton').call('get_bone_count')).toBe(2);
    expect(await scene.getNode('Bare').call('get_bone_count')).toBe(0);
  });
});
