/**
 * The tiles Godot creates in an atlas once its texture reports its size at load: none while a
 * ViewportTexture is not yet set up.
 */
import { describe, it, expect } from 'vitest';
import { tileSetFromScene } from './decode';
import { withTilesSizedAtLoad } from './sizedAtLoad';
import type { TscnInternalResource } from '../../parser/types';

const NO_FILE = () => undefined;

function sizedAtLoad(internalResources: TscnInternalResource[]) {
  return withTilesSizedAtLoad(tileSetFromScene('SubResource("ts")', internalResources, [])!, NO_FILE);
}

describe('withTilesSizedAtLoad', () => {
  /**
   * `create_tile` needs room in the atlas grid of the texture's size (`tile_set.cpp:4985`, `:5200-5211`),
   * and a ViewportTexture reports size 0 while the scene loads (`viewport.cpp:156-160`).
   */
  it('creates no tile in an atlas whose texture is a ViewportTexture, through a CanvasTexture too', () => {
    const viewportAtlas: TscnInternalResource[] = [
      { id: 'vt', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
      { id: 'ct', type: 'CanvasTexture', data: { diffuse_texture: 'SubResource("vt")' } },
      { id: 'direct', type: 'TileSetAtlasSource', data: { texture: 'SubResource("vt")', '0:0/0': '0' } },
      { id: 'wrapped', type: 'TileSetAtlasSource', data: { texture: 'SubResource("ct")', '0:0/0': '0' } },
      {
        id: 'ts',
        type: 'TileSet',
        data: { 'sources/0': 'SubResource("direct")', 'sources/1': 'SubResource("wrapped")' },
      },
    ];
    const model = sizedAtLoad(viewportAtlas);
    expect([model.sources.get(0)!.tiles.size, model.sources.get(1)!.tiles.size]).toEqual([0, 0]);
  });

  /** An AtlasTexture reports its region's size, and its sheet's on a zero axis (`atlas_texture.cpp:32-52`). */
  it('creates no tile through an AtlasTexture of the whole ViewportTexture, and keeps one through a region', () => {
    const viewportAtlas: TscnInternalResource[] = [
      { id: 'vt', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
      { id: 'whole', type: 'AtlasTexture', data: { atlas: 'SubResource("vt")' } },
      {
        id: 'cell',
        type: 'AtlasTexture',
        data: { atlas: 'SubResource("vt")', region: 'Rect2(0, 0, 16, 16)' },
      },
      { id: 'w', type: 'TileSetAtlasSource', data: { texture: 'SubResource("whole")', '0:0/0': '0' } },
      { id: 'c', type: 'TileSetAtlasSource', data: { texture: 'SubResource("cell")', '0:0/0': '0' } },
      {
        id: 'ts',
        type: 'TileSet',
        data: { 'sources/0': 'SubResource("w")', 'sources/1': 'SubResource("c")' },
      },
    ];
    const model = sizedAtLoad(viewportAtlas);
    expect([model.sources.get(0)!.tiles.size, model.sources.get(1)!.tiles.size]).toEqual([0, 1]);
  });
});
