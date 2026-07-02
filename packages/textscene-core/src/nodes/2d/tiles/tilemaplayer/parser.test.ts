import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseTileMapLayer } from './parser';

describe('parseTileMapLayer', () => {
  it('parses the Node2D base plus tile_set ref and enabled (happy path)', () => {
    const result = parseTileMapLayer(
      heading('TileMapLayer', { name: 'Layer0', parent: '.' }),
      { position: 'Vector2(10, 20)', tile_set: 'ExtResource("1")', enabled: 'false' }
    );
    expect(result.name).toBe('Layer0');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.tile_set).toBe('ExtResource("1")');
    expect(result.enabled).toBe(false);
  });

  it('decodes tile_map_data into placed cells at parse time', () => {
    const result = parseTileMapLayer(heading('TileMapLayer', { name: 'L' }), {
      tile_map_data: 'PackedByteArray(0, 0, 9, 0, 11, 0, 2, 0, 1, 0, 0, 0, 5, 0)',
    });
    expect(result.cells).toEqual([
      { coords: { x: 9, y: 11 }, sourceId: 2, atlasCoords: { x: 1, y: 0 }, alternativeId: 5 },
    ]);
  });
});
