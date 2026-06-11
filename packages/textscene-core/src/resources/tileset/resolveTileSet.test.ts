/**
 * TileSet resolver — normalizes a TileSet reference into the TileSetModel.
 * Scene adapter: the TileSet and its atlas sources are SubResources of the
 * scene; texture refs resolve against the scene's external resources.
 */
import { describe, it, expect } from 'vitest';
import { tileSetFromScene } from './resolveTileSet';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

const externals: TscnExternalResource[] = [
  { id: '2', type: 'Texture2D', path: 'res://tiles.png' },
];

const internals: TscnInternalResource[] = [
  {
    id: 'atlas1',
    type: 'TileSetAtlasSource',
    data: {
      id: 'atlas1',
      texture: 'ExtResource("2")',
      texture_region_size: 'Vector2i(32, 24)',
    },
  },
  {
    id: 'ts',
    type: 'TileSet',
    data: { id: 'ts', 'sources/0': 'SubResource("atlas1")' },
  },
];

describe('tileSetFromScene', () => {
  it('resolves an embedded TileSet: grid defaults plus an atlas source with texture path and region size', () => {
    const model = tileSetFromScene('SubResource("ts")', internals, externals);
    expect(model).not.toBeNull();
    expect(model!.tileSize).toEqual({ x: 16, y: 16 }); // Godot default
    const source = model!.sources.get(0);
    expect(source).toBeDefined();
    expect(source!.texturePath).toBe('res://tiles.png');
    expect(source!.textureRegionSize).toEqual({ x: 32, y: 24 });
    expect(source!.margins).toEqual({ x: 0, y: 0 });
    expect(source!.separation).toEqual({ x: 0, y: 0 });
  });

  it('reads per-tile entries: alternatives with flip flags, texture_origin, and size_in_atlas', () => {
    const richInternals: TscnInternalResource[] = [
      {
        id: 'atlas1',
        type: 'TileSetAtlasSource',
        data: {
          id: 'atlas1',
          texture: 'ExtResource("2")',
          '0:0/next_alternative_id': '2',
          '0:0/0': '0',
          '0:0/1': '1',
          '0:0/1/flip_h': 'true',
          '0:0/1/transpose': 'true',
          '2:1/0': '0',
          '2:1/0/texture_origin': 'Vector2i(0, -16)',
          '1:3/size_in_atlas': 'Vector2i(2, 2)',
          '1:3/0': '0',
        },
      },
      { id: 'ts', type: 'TileSet', data: { id: 'ts', 'sources/0': 'SubResource("atlas1")' } },
    ];
    const model = tileSetFromScene('SubResource("ts")', richInternals, externals);
    const source = model!.sources.get(0)!;

    expect(source.tiles.get('0:0')!.alternatives.get(1)).toEqual({
      flipH: true,
      flipV: false,
      transpose: true,
      textureOrigin: { x: 0, y: 0 },
    });
    expect(source.tiles.get('2:1')!.alternatives.get(0)!.textureOrigin).toEqual({ x: 0, y: -16 });
    expect(source.tiles.get('1:3')!.sizeInAtlas).toEqual({ x: 2, y: 2 });
  });
});
