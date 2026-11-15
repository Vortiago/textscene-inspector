/**
 * A TileMap draws its layers through the tile path of a TileMapLayer (`tile_map.cpp:277-279`), so
 * one whose atlas source draws a CanvasTexture lights through the CanvasTexture's maps alike.
 */
import { parseTileMap } from './parser';
import { subResource } from '../../../../testing/subResource';
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitScene,
} from '../../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';

const TILE_SET = [
  subResource('TileSetAtlasSource', 'atlas', {
    texture: CANVAS_TEXTURE_REF,
    texture_region_size: 'Vector2i(8, 8)',
    '0:0/0': '0',
  }),
  subResource('TileSet', 'ts', { 'sources/0': 'SubResource("atlas")' }),
];

function tileMapNode(): TscnNode {
  const heading = { type: 'node' as const, attributes: { type: 'TileMap', name: 'M' } };
  return {
    rawProperties: {},
    name: 'M',
    type: 'TileMap',
    children: [],
    properties: parseTileMap(heading, {
      format: '2',
      tile_set: 'SubResource("ts")',
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
    }),
  };
}

function render(wrapper: TscnInternalResource) {
  return renderLitScene(tileMapNode(), [...TILE_SET, wrapper]);
}

describeCanvasTextureItem('TileMap', render);
