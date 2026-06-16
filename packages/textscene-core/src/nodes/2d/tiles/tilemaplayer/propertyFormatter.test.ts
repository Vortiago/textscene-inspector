import { describe, it, expect } from 'vitest';
import { parseTileMapLayer } from './parser';
import { formatTileMapLayerProperties } from './propertyFormatter';

const heading = { type: 'node', attributes: { type: 'TileMapLayer', name: 'L' } };

describe('formatTileMapLayerProperties', () => {
  it('summarizes the tile surface: tile_set ref, decoded cell count, enabled', () => {
    const props = parseTileMapLayer(heading, {
      tile_set: 'ExtResource("1")',
      tile_map_data: 'PackedByteArray(0, 0, 9, 0, 11, 0, 2, 0, 1, 0, 0, 0, 5, 0)',
      enabled: 'false',
    });
    const sections = formatTileMapLayerProperties(props);
    const tileSection = sections.find((s) => s.title === 'Tile Map');
    expect(tileSection).toBeDefined();
    expect(tileSection!.items).toContainEqual({ label: 'Tile Set', value: 'ExtResource("1")' });
    expect(tileSection!.items).toContainEqual({ label: 'Cells', value: '1' });
    expect(tileSection!.items).toContainEqual({ label: 'Enabled', value: 'No' });
  });

  it('appends the Node2D base sections', () => {
    const sections = formatTileMapLayerProperties(parseTileMapLayer(heading, {}));
    expect(sections.some((s) => s.title === 'Position')).toBe(true);
  });
});
