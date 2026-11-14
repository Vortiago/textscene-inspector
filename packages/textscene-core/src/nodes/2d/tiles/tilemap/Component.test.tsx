import { describe, expect, it, vi } from 'vitest';
import { INERT_CANVAS_LIGHTING } from '../../../../r3f/lighting2d/lightPassContext';
import type { CappedItem } from '../../../../r3f/lighting2d/itemLightCap';
import { LAYER_LIGHT_MASK, polygonMeshes, renderTileMap, tileMeshes } from './tileMap.testkit';

describe('<TileMap>', () => {
  it('mounts the TileMap with its authored child', async () => {
    const renderer = await renderTileMap('tile_set = SubResource("ts")');
    expect(renderer.scene.findByProps({ name: 'Map' })).toBeDefined();
    expect(polygonMeshes(renderer)).toHaveLength(2);
  });
});

describe('TileMap degradation (ADR-0008)', () => {
  it('a dangling tile_set reference degrades to a transform-only group: child renders, no tile geometry', async () => {
    const renderer = await renderTileMap(
      'tile_set = SubResource("nope")\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)'
    );
    expect(polygonMeshes(renderer)).toHaveLength(2);
    expect(tileMeshes(renderer)).toHaveLength(0);
  });

  it('a TileMap with no tile_set property at all also degrades to a transform-only group', async () => {
    const renderer = await renderTileMap('layer_0/tile_data = PackedInt32Array(0, 0, 0)');
    expect(tileMeshes(renderer)).toHaveLength(0);
  });

  it('an undecodable layer is skipped while other enabled layers still render', async () => {
    // Not a whole number of int32 triplets, so decodeLegacyTileData returns
    // null and the layer is skipped, with no partial geometry.
    const renderer = await renderTileMap(
      [
        'tile_set = SubResource("ts")',
        'layer_0/tile_data = PackedInt32Array(0, 0, 0)',
        'layer_1/tile_data = PackedInt32Array(1, 0)',
      ].join('\n')
    );
    expect(tileMeshes(renderer)).toHaveLength(1);
  });

  /** Renders `lines` with a lighting pass that spies on the capped items the layers declare. */
  async function renderLit(lines: string[]) {
    const registerCappedItem = vi.fn((_item: CappedItem) => () => {});
    await renderTileMap(['tile_set = SubResource("ts")', ...lines].join('\n'), {
      ...INERT_CANVAS_LIGHTING,
      registerCappedItem,
    });
    return registerCappedItem.mock.calls
      .map(([item]) => item.placement)
      .filter(({ lightMask }) => lightMask === LAYER_LIGHT_MASK);
  }

  it('declares each rendering quadrant of a layer as a lit item (tile_map_layer.cpp:542-566)', async () => {
    // Cells (0, 0) and (16, 0) fall in two 16-cell quadrants.
    const placements = await renderLit(['layer_0/tile_data = PackedInt32Array(0, 0, 0, 16, 0, 0)']);
    expect(placements).toHaveLength(2);
  });

  it('splits the quadrants by the rendering_quadrant_size the TileMap sets', async () => {
    const placements = await renderLit([
      'rendering_quadrant_size = 32',
      'layer_0/tile_data = PackedInt32Array(0, 0, 0, 16, 0, 0)',
    ]);
    expect(placements).toHaveLength(1);
  });

  it("declares a layer's quadrants at the layer's own z_final", async () => {
    const placements = await renderLit([
      'z_index = 1',
      'layer_0/tile_data = PackedInt32Array(0, 0, 0)',
      'layer_0/z_index = 2',
    ]);
    expect(placements.map(({ z }) => z)).toEqual([3]);
  });
});
