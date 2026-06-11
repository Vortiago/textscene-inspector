import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTileMap } from './parser';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseTileMap', () => {
  it('collects layers in index order with per-layer surface and decoded cells', () => {
    const result = parseTileMap(heading({ name: 'Map', type: 'TileMap', parent: '.' }), {
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

  it('handles a TileMap without layers or tile_set (edge case)', () => {
    const result = parseTileMap(heading({}), {});
    expect(result.name).toBe('');
    expect(result.layers).toEqual([]);
    expect(result.tile_set).toBeUndefined();
  });
});
