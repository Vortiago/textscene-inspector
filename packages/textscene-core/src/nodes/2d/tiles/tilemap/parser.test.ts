import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseTileMap } from './parser';

describe('parseTileMap', () => {
  it('collects layers in index order with per-layer surface and decoded cells', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      position: 'Vector2(-64, -32)',
      tile_set: 'ExtResource("1")',
      format: '2',
      'layer_0/name': '"Ground"',
      'layer_0/tile_data': 'PackedInt32Array(-917493, 0, 0)',
      'layer_1/name': '"Walls"',
      'layer_1/z_index': '1',
      'layer_1/enabled': 'false',
      'layer_1/tile_data': 'PackedInt32Array(0, 2, 65536)',
    });

    expect(result.position).toEqual({ x: -64, y: -32 });
    expect(result.tile_set).toBe('ExtResource("1")');
    expect(result.layers).toHaveLength(2);
    expect(result.layers[0]).toMatchObject({ name: 'Ground', enabled: true, zIndex: 0 });
    expect(result.layers[0]!.cells).toEqual([
      { coords: { x: 11, y: -14 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
    ]);
    expect(result.layers[1]).toMatchObject({ name: 'Walls', enabled: false, zIndex: 1 });
    expect(result.layers[1]!.cells).toEqual([
      { coords: { x: 0, y: 0 }, sourceId: 2, atlasCoords: { x: 0, y: 0 }, alternativeId: 1 },
    ]);
  });

  // `TileMap::_set` routes the family through `property_helper.is_property_valid`
  // (tile_map.cpp:700), which gates the index on `String::is_valid_int()`
  // (property_list_helper.cpp:125) — one optional sign, `+` as readily as `-`
  // (ustring.cpp:4752). `property_set_value` then refuses a negative index at
  // `_get_property`'s `if (index < 0 …) return nullptr` (:58).
  it('resolves a layer index the way is_valid_int does', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_0/name': '"Ground"',
      'layer_+0/z_index': '3',
      'layer_+1/name': '"Walls"',
      'layer_-1/name': '"Dropped"',
      'layer_x/name': '"Dropped"',
    });

    expect(result.layers).toHaveLength(2);
    expect(result.layers[0]).toMatchObject({ name: 'Ground', zIndex: 3 });
    expect(result.layers[1]).toMatchObject({ name: 'Walls' });
  });

  it('handles a TileMap without layers or tile_set (edge case)', () => {
    const result = parseTileMap({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.layers).toEqual([]);
    expect(result.tile_set).toBeUndefined();
  });
});
