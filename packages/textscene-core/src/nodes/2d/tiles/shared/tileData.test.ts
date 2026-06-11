/**
 * Tile-data decoder — TileMapLayer's `tile_map_data` PackedByteArray (2-byte
 * LE format header, then 12-byte cell records: int16 x, int16 y, uint16
 * source_id, uint16 atlas_x, uint16 atlas_y, uint16 alternative).
 */
import { describe, it, expect } from 'vitest';
import { decodeTileMapData } from './tileData';

describe('decodeTileMapData', () => {
  it('decodes a single cell from the comma-separated byte form', () => {
    // header(0,0) + cell x=9, y=11, source=2, atlas=(1,0), alternative=5
    const value = 'PackedByteArray(0, 0, 9, 0, 11, 0, 2, 0, 1, 0, 0, 0, 5, 0)';
    expect(decodeTileMapData(value)).toEqual([
      {
        coords: { x: 9, y: 11 },
        sourceId: 2,
        atlasCoords: { x: 1, y: 0 },
        alternativeId: 5,
      },
    ]);
  });
});
