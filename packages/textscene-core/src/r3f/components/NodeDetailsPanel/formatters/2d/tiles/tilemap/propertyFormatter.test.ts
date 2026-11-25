import { describe, it, expect } from 'vitest';
import { formatTileMapProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, sectionTitled } from '../../../testing/inspectedScene';

describe('formatTileMapProperties', () => {
  it('lists the tile set path and the used cells of each layer', async () => {
    const sections = await sectionsOf(
      formatTileMapProperties,
      'TileMap',
      {
        tile_set: 'SubResource("ts")',
        format: '2',
        'layer_0/name': '"Ground"',
        'layer_0/tile_data': 'PackedInt32Array(0, 0, 0, 1, 0, 0)',
        'layer_1/tile_data': 'PackedInt32Array(2, 0, 0)',
      },
      { sub: { ts: 'TileSet' } }
    );
    const tileSection = sectionTitled(sections, 'Tile Map');
    expect(tileSection!.items).toContainEqual({ label: 'Tile Set', value: `${SCENE_PATH}::ts` });
    expect(tileSection!.items).toContainEqual({ label: 'Layers', value: '2' });
    expect(tileSection!.items).toContainEqual({ label: 'Ground', value: '2 cells' });
    // An unnamed layer answers to the name `_set` gave it: `vformat("Layer%d", index)` (tile_map.cpp:706).
    expect(tileSection!.items).toContainEqual({ label: 'Layer1', value: '1 cell' });
  });

  it('appends the Node2D base sections', async () => {
    const sections = await sectionsOf(formatTileMapProperties, 'TileMap');
    expect(sectionTitled(sections, 'Position')).toBeDefined();
  });
});
