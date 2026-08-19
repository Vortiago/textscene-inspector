import { describe, it, expect } from 'vitest';
import { parseTileMap } from './parser';
import { formatTileMapProperties } from './propertyFormatter';

const heading = { type: 'node', attributes: { type: 'TileMap', name: 'Map' } };

describe('formatTileMapProperties', () => {
  it('summarizes the tile surface: tile_set ref and per-layer cell counts', () => {
    const props = parseTileMap(heading, {
      tile_set: 'SubResource("ts")',
      format: '2',
      'layer_0/name': '"Ground"',
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0, 1, 0, 0)',
      'layer_1/tile_data': 'PackedInt32Array(2, 0, 0)',
    });
    const sections = formatTileMapProperties(props);
    const tileSection = sections.find((s) => s.title === 'Tile Map');
    expect(tileSection).toBeDefined();
    expect(tileSection!.items).toContainEqual({ label: 'Tile Set', value: 'SubResource("ts")' });
    expect(tileSection!.items).toContainEqual({ label: 'Layers', value: '2' });
    expect(tileSection!.items).toContainEqual({ label: 'Ground', value: '2 cells' });
    // An unnamed layer answers to the name `_set` built it with,
    // `vformat("Layer%d", index)` (tile_map.cpp:706).
    expect(tileSection!.items).toContainEqual({ label: 'Layer1', value: '1 cell' });
  });

  it('appends the Node2D base sections', () => {
    const sections = formatTileMapProperties(parseTileMap(heading, {}));
    expect(sections.some((s) => s.title === 'Position')).toBe(true);
  });
});
