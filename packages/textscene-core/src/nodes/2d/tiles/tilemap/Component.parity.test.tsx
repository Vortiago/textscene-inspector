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
import { isMesh, isBasicMaterial } from '../../../../r3f/testing/threeNarrow';

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

/** The basic material a drawn mesh carries. */
function basicMaterial(instance: THREE.Object3D): THREE.MeshBasicMaterial {
  if (!isMesh(instance)) throw new Error('scene-graph instance is not a Mesh');
  const material = instance.material;
  if (Array.isArray(material) || !isBasicMaterial(material)) {
    throw new Error('mesh material is not a MeshBasicMaterial');
  }
  return material;
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
    // Atlas sources sit at a FRACTION of one layer step rather than at the
    // layer base, so a layer's sources can never reach the layer above it.
    // The FIRST source takes no nudge at all — a lone source must not lift the
    // layer off the z it shares with its siblings.
    const sourceNudge = 0;
    expect(layer0!.position.z).toBeCloseTo(sourceNudge, 8);
    expect(layer1!.position.z).toBeCloseTo(
      1 * Z_INDEX_STEP + 1 * TILE_LAYER_STEP + sourceNudge,
      8
    );
    // The ordering the rule exists for still holds.
    expect(layer1!.position.z).toBeGreaterThan(layer0!.position.z);
  });

  it('renders an empty group for a TileMap with a tile_set but zero layers', async () => {
    const r = await render(makeNode({}));
    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(r.scene.findByProps({ name: 'Map' })).toBeDefined();
  });

  it("applies layer_N/modulate to that layer's pixels (composed in sRGB, like the CanvasItem chain)", async () => {
    const r = await render(
      makeNode({
        'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)',
        'layer_0/modulate': 'Color(0.5, 0.5, 0.5, 0.5)',
      })
    );
    const material = basicMaterial(r.scene.findByType('Mesh').instance);
    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
    expect(material.opacity).toBeCloseTo(0.5, 5);
  });
});
