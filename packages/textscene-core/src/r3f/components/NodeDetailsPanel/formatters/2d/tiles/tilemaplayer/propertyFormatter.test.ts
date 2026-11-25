import { describe, it, expect } from 'vitest';
import { formatTileMapLayerProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../../testing/inspectedScene';

describe('formatTileMapLayerProperties', () => {
  it('lists the tile set path, the used cell count and whether the layer is enabled', async () => {
    const sections = await sectionsOf(
      formatTileMapLayerProperties,
      'TileMapLayer',
      {
        tile_set: 'ExtResource("1")',
        tile_map_data: 'PackedByteArray(0, 0, 9, 0, 11, 0, 2, 0, 1, 0, 0, 0, 5, 0)',
        enabled: 'false',
      },
      { ext: { '1': 'TileSet' } }
    );
    const tileSection = sectionTitled(sections, 'Tile Map');
    expect(tileSection!.items).toContainEqual({ label: 'Tile Set', value: 'res://1' });
    expect(tileSection!.items).toContainEqual({ label: 'Cells', value: '1' });
    expect(tileSection!.items).toContainEqual({ label: 'Enabled', value: 'No' });
  });

  it('appends the Node2D base sections', async () => {
    const sections = await sectionsOf(formatTileMapLayerProperties, 'TileMapLayer');
    expect(sectionTitled(sections, 'Position')).toBeDefined();
  });
});
