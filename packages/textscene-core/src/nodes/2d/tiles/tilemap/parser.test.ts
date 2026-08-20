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

  // `TileMap::_set` GROWS the vector until the written index exists —
  // `while (index >= layers.size()) { … set_name(vformat("Layer%d", index)); }`
  // (tile_map.cpp:701-710) — so the layers below the highest one written load
  // at TileMapLayer's own defaults, under the engine's own names.
  it('fills the layers below the highest index written, at their defaults', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      format: '2',
      'layer_2/tile_data': 'PackedInt32Array(0, 0, 0)',
    });

    expect(result.layers).toHaveLength(3);
    expect(result.layers.map((layer) => layer.name)).toEqual(['Layer0', 'Layer1', 'Layer2']);
    expect(result.layers[0]).toMatchObject({ enabled: true, zIndex: 0, cells: [] });
    expect(result.layers[1]).toMatchObject({ enabled: true, zIndex: 0, cells: [] });
    expect(result.layers[2]!.cells).toEqual([
      { coords: { x: 0, y: 0 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
    ]);
  });

  // Growth is gated on the leaf, not just the index: `_set` reaches the loop
  // only through `is_property_valid` (tile_map.cpp:700), which ends at
  // `property_list.has(components[1])` (property_list_helper.cpp:135) over the
  // eight leaves `register_property` declares (tile_map.cpp:1030-1039).
  it('grows the vector for a leaf the property helper registers', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_3/y_sort_origin': '4',
    });

    expect(result.layers.map((layer) => layer.name)).toEqual([
      'Layer0',
      'Layer1',
      'Layer2',
      'Layer3',
    ]);
  });

  it('grows the vector for no other leaf', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_9/bogus': '1',
      'layer_9/name/deeper': '"Dropped"',
    });

    expect(result.layers.map((layer) => layer.name)).toEqual(['Layer0']);
  });

  // Fence: `Node::set_name` opens with `ERR_FAIL_COND(p_name.is_empty())`
  // (node.cpp:1432), so an empty `layer_N/name` never lands and the layer keeps
  // the name `_set` built it with. `??` in place of `||` would take the "".
  it('keeps the engine name when layer_N/name is empty', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_0/name': '""',
    });

    expect(result.layers[0]!.name).toBe('Layer0');
  });

  // A sparse index is otherwise a `layers` array as long as the number
  // written: `layer_2000000000/tile_data` is 33 bytes.
  it('stops filling at a sparse index, keeping the layers the file writes', () => {
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      format: '2',
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
      'layer_1000/tile_data': 'PackedInt32Array(1, 0, 0)',
      'layer_4294967296/name': '"Far"',
    });

    expect(result.layers.map((layer) => layer.name)).toEqual(['Layer0', 'Layer1000', 'Far']);
  });

  // The fill ceiling costs a contiguous file nothing: every index between its
  // layers is one it writes, so the two branches agree past 64 layers.
  it('keeps every layer of a contiguous file past the fill ceiling', () => {
    const properties = Object.fromEntries(
      Array.from({ length: 71 }, (_, index) => [`layer_${index}/z_index`, '0'])
    );
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), properties);

    expect(result.layers).toHaveLength(71);
    expect(result.layers[70]!.name).toBe('Layer70');
    expect(result.layers.map((layer) => layer.name)).toEqual(
      Array.from({ length: 71 }, (_, index) => `Layer${index}`)
    );
  });

  // `TileMap::TileMap()` builds a "Layer0" TileMapLayer and pushes it before any
  // property is applied (tile_map.cpp:1014-1021), so the vector is never empty.
  it('handles a TileMap without layers or tile_set (edge case)', () => {
    const result = parseTileMap({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.layers).toEqual([
      { name: 'Layer0', enabled: true, zIndex: 0, cells: [] },
    ]);
    expect(result.tile_set).toBeUndefined();
  });

  it('reads an absent format as the current one, not as Godot 3 data', () => {
    // `mutable TileMapDataFormat format = TILE_MAP_DATA_FORMAT_3` (tile_map.h:64),
    // which is 2. Defaulting to 0 dropped every cell of an unversioned TileMap.
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0, 1, 65536, 0)',
    });
    expect(result.layers[0]?.cells).toHaveLength(2);
  });

  it('fills the layers Godot builds for a skipped index', () => {
    // `_set` grows `layers` one at a time up to the written index
    // (tile_map.cpp:701-710), so layer 1 exists at TileMapLayer's own defaults.
    const result = parseTileMap(heading('TileMap', { name: 'Map', parent: '.' }), {
      'layer_0/name': '"Ground"',
      'layer_2/name': '"Sky"',
    });
    expect(result.layers.map((l) => l.name)).toEqual(['Ground', 'Layer1', 'Sky']);
  });
});
