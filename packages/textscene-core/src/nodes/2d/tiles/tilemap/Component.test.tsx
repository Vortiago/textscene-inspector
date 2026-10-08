import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import { parseTileMap } from './parser';
import { TileMap } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from '../../../../r3f/lighting2d/lightPassContext';
import type { CappedItem } from '../../../../r3f/lighting2d/itemLightCap';

const baseNode: TscnNode = {
  rawProperties: {},
  name: 'MyTileMap',
  type: 'TileMap',
  children: [],
  properties: parseTileMap({ type: 'node', attributes: { type: 'TileMap', name: 'MyTileMap' } }, {}),
};

describe('<TileMap>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TileMap node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TileMap node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </TileMap>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});

describe('TileMap degradation (ADR-0008)', () => {
  const heading = { type: 'node' as const, attributes: { type: 'TileMap', name: 'Map' } };
  const TEX = 'res://tiles.png';
  const externals: TscnExternalResource[] = [{ id: '2', type: 'Texture2D', path: TEX }];
  const internals: TscnInternalResource[] = [
    {
      id: 'atlas1',
      type: 'TileSetAtlasSource',
      data: { texture: 'ExtResource("2")', texture_region_size: 'Vector2i(16, 16)', '0:0/0': '0' },
    },
    { id: 'ts', type: 'TileSet', data: { 'sources/0': 'SubResource("atlas1")' } },
  ];

  function makeMapNode(raw: Record<string, string>): TscnNode {
    return {
      rawProperties: {},
      name: 'Map',
      type: 'TileMap',
      children: [],
      properties: parseTileMap(heading, { format: '2', ...raw }),
    };
  }

  async function render(node: TscnNode, lighting = INERT_CANVAS_LIGHTING) {
    const fake = createFakeResourceLoader();
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 32 };
    fake.textures.seed(TEX, tex);
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={internals} externalResources={externals}>
          <CanvasLighting2DContext.Provider value={lighting}>
            <TileMap node={node}>
              <mesh name="scene-child">
                <planeGeometry />
                <meshBasicMaterial />
              </mesh>
            </TileMap>
          </CanvasLighting2DContext.Provider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('a dangling tile_set reference degrades to a transform-only group: child renders, no tile geometry', async () => {
    const r = await render(
      makeMapNode({ tile_set: 'SubResource("nope")', 'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)' })
    );
    expect(r.scene.findByProps({ name: 'scene-child' })).toBeDefined();
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1); // only the scene child
  });

  it('a TileMap with no tile_set property at all also degrades to a transform-only group', async () => {
    const r = await render(makeMapNode({ 'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)' }));
    expect(r.scene.findByProps({ name: 'scene-child' })).toBeDefined();
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('an undecodable layer is skipped while other enabled layers still render', async () => {
    const r = await render(
      makeMapNode({
        tile_set: 'SubResource("ts")',
        'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
        // Not a whole number of int32 triplets, so decodeLegacyTileData returns
        // null and the layer is skipped, with no partial geometry.
        'layer_1/tile_data': 'PackedInt32Array(1, 0)',
      })
    );
    // layer_0's one tile mesh + the always-rendered scene child.
    expect(r.scene.findAllByType('Mesh')).toHaveLength(2);
    expect(r.scene.findByProps({ name: 'scene-child' })).toBeDefined();
  });

  /** Renders `raw` with a lighting pass that spies on the capped items the layers declare. */
  async function renderLit(raw: Record<string, string>) {
    const registerCappedItem = vi.fn((_item: CappedItem) => () => {});
    await render(makeMapNode({ tile_set: 'SubResource("ts")', ...raw }), {
      ...INERT_CANVAS_LIGHTING,
      registerCappedItem,
    });
    return registerCappedItem.mock.calls.map(([item]) => item.placement);
  }

  it('declares each rendering quadrant of a layer as a lit item (tile_map_layer.cpp:542-566)', async () => {
    // Cells (0, 0) and (16, 0) fall in two 16-cell quadrants.
    const placements = await renderLit({ 'layer_0/tile_data': 'PackedInt32Array(0, 0, 0, 16, 0, 0)' });
    expect(placements).toHaveLength(2);
  });

  it('splits the quadrants by the rendering_quadrant_size the TileMap sets', async () => {
    const placements = await renderLit({
      rendering_quadrant_size: '32',
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0, 16, 0, 0)',
    });
    expect(placements).toHaveLength(1);
  });

  it("declares a layer's quadrants at the layer's own z_final", async () => {
    const placements = await renderLit({
      z_index: '1',
      'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
      'layer_0/z_index': '2',
    });
    expect(placements.map(({ z }) => z)).toEqual([3]);
  });
});
