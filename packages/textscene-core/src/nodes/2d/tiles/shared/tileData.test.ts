/**
 * Tile-data decoder — TileMapLayer's `tile_map_data` PackedByteArray (2-byte
 * LE format header, then 12-byte cell records: int16 x, int16 y, uint16
 * source_id, uint16 atlas_x, uint16 atlas_y, uint16 alternative).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as logger from '../../../../logger';
import { decodeLegacyTileData, decodeTileMapData } from './tileData';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

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

  it('decodes multiple cells including negative coordinates (signed int16)', () => {
    // x=-1 → 255,255; y=-2 → 254,255
    const value =
      'PackedByteArray(0, 0, 255, 255, 254, 255, 0, 0, 3, 0, 2, 0, 0, 0, 5, 0, 6, 0, 1, 0, 0, 0, 0, 0, 7, 0)';
    expect(decodeTileMapData(value)).toEqual([
      { coords: { x: -1, y: -2 }, sourceId: 0, atlasCoords: { x: 3, y: 2 }, alternativeId: 0 },
      { coords: { x: 5, y: 6 }, sourceId: 1, atlasCoords: { x: 0, y: 0 }, alternativeId: 7 },
    ]);
  });

  it('decodes the base64 string form Godot 4.3+ writes', () => {
    // Same bytes as the single-cell example, base64-encoded.
    expect(decodeTileMapData('PackedByteArray("AAAJAAsAAgABAAAABQA=")')).toEqual([
      { coords: { x: 9, y: 11 }, sourceId: 2, atlasCoords: { x: 1, y: 0 }, alternativeId: 5 },
    ]);
  });

  it('returns null and warns on corrupt data (truncated record, bad numbers, bad base64, unknown version)', () => {
    // 2-byte header + 13 bytes: not a whole 12-byte record.
    expect(decodeTileMapData(`PackedByteArray(${new Array(15).fill(0).join(', ')})`)).toBeNull();
    expect(decodeTileMapData('PackedByteArray(0, 0, nope, 0)')).toBeNull();
    expect(decodeTileMapData('PackedByteArray("not base64!!!")')).toBeNull();
    // Unknown format version in the header (only version 0 exists today).
    expect(decodeTileMapData('PackedByteArray(7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)')).toBeNull();
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('decodeLegacyTileData (TileMap layer_N/tile_data, TSCN format = 2)', () => {
  it('decodes int32 triplets — same 12-byte record as tile_map_data, no header', () => {
    // Real cells from the 4.2-era isometric dungeon: -917493 packs (x=11, y=-14).
    expect(decodeLegacyTileData('PackedInt32Array(-917493, 0, 0, 0, 2, 65536)', 2)).toEqual([
      { coords: { x: 11, y: -14 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
      { coords: { x: 0, y: 0 }, sourceId: 2, atlasCoords: { x: 0, y: 0 }, alternativeId: 1 },
    ]);
  });

  it('returns null and warns on Godot-3-era formats and corrupt data', () => {
    // formats 0/1 (TILE_MAP_DATA_FORMAT_1/2) need the Godot-3 compat mapping — out of scope.
    expect(decodeLegacyTileData('PackedInt32Array(0, 0)', 1)).toBeNull();
    // Not a whole number of triplets.
    expect(decodeLegacyTileData('PackedInt32Array(0, 0, 0, 1)', 2)).toBeNull();
    expect(decodeLegacyTileData('PackedInt32Array(0, nope, 0)', 2)).toBeNull();
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps decoding a body Godot loads, however the ints are spelled', () => {
    // An empty body is an empty layer, not corrupt data.
    expect(decodeLegacyTileData('PackedInt32Array()', 2)).toEqual([]);

    // `_parse_construct<int32_t>` (variant_parser.cpp:1428-1430) takes any
    // number token and narrows it, so all three of these are files Godot opens
    // — and `parseInt` read `2e3` as 2, put the cell 998 tiles from where Godot
    // puts it, and NaN'd the whole layer on `inf`.
    expect(decodeLegacyTileData('PackedInt32Array(2e3, 0, 0)', 2)).toEqual([
      { coords: { x: 2000, y: 0 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
    ]);
    // Truncation toward zero, matching the C++ conversion.
    expect(decodeLegacyTileData('PackedInt32Array(1e-3, 0, 0)', 2)).toEqual([
      { coords: { x: 0, y: 0 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
    ]);
    // A non-finite is narrowed at parse to an architecture-specific sentinel,
    // so there is no cell position to draw — the layer decodes to nothing
    // rather than to a cell the file never placed.
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(decodeLegacyTileData(`PackedInt32Array(${spelling}, 0, 0)`, 2)).toBeNull();
    }
  });
});
