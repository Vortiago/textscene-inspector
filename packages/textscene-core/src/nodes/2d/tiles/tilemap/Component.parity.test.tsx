/**
 * Parity: legacy TileMap renders each enabled layer's cells in order — layer
 * z_index moves a full Z_INDEX_STEP (interleaves with sibling CanvasItems),
 * layer index breaks ties with TILE_LAYER_STEP.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTileMap } from './parser';
import { TileMap } from './Component';
import { Z_INDEX_STEP, TILE_LAYER_STEP } from '../../../../r3f/node2dTransform';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'TileMap', name: 'Map' } };
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

function makeNode(raw: Record<string, string>): TscnNode {
  return {
    name: 'Map',
    type: 'TileMap',
    children: [],
    properties: parseTileMap(heading, { tile_set: 'SubResource("ts")', format: '2', ...raw }),
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
        <TileMap node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('TileMap render parity', () => {
  it('renders enabled layers in order with the layer z rule; disabled layers are skipped', async () => {
    const r = await render(
      makeNode({
        'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
        'layer_1/z_index': '1',
        'layer_1/tile_data': 'PackedInt32Array(1, 0, 0)',
        'layer_2/enabled': 'false',
        'layer_2/tile_data': 'PackedInt32Array(2, 0, 0)',
      })
    );

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(2);
    const [layer0, layer1] = meshes.map((m) => m.instance as THREE.Mesh);
    expect(layer0!.position.z).toBeCloseTo(0, 8);
    expect(layer1!.position.z).toBeCloseTo(1 * Z_INDEX_STEP + 1 * TILE_LAYER_STEP, 8);
  });
});
