import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import { parseTileMap } from './parser';
import { TileMap } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';

const baseNode: TscnNode = {
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
      data: { id: 'atlas1', texture: 'ExtResource("2")', texture_region_size: 'Vector2i(16, 16)' },
    },
    { id: 'ts', type: 'TileSet', data: { id: 'ts', 'sources/0': 'SubResource("atlas1")' } },
  ];

  function makeMapNode(raw: Record<string, string>): TscnNode {
    return {
      name: 'Map',
      type: 'TileMap',
      children: [],
      properties: parseTileMap(heading, { format: '2', ...raw }),
    };
  }

  async function render(node: TscnNode) {
    const fake = createFakeResourceLoader();
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 32 };
    fake.textures.seed(TEX, tex);
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={internals} externalResources={externals}>
          <TileMap node={node}>
            <mesh name="scene-child">
              <planeGeometry />
              <meshBasicMaterial />
            </mesh>
          </TileMap>
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
});
