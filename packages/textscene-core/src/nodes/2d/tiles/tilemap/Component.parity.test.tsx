/**
 * Parity: legacy TileMap renders each enabled layer's cells in order — layer
 * draw order within the node is a rank over `(layer z_index, layer index,
 * atlas source)`, carried by each batch mesh's own `renderOrder`.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { nearestGroupOrder } from '../../../../r3f/testing/paintOrder';
import { PAINT_SEQUENCE_STRIDE } from '../../../../r3f/canvasPaintOrder';
import { parseTileMap } from './parser';
import { TileMap } from './Component';
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
    const [layer0, layer1] = meshes.map((m) => m.instance as THREE.Object3D);
    // Godot's TileMap `add_child`s a real `TileMapLayer` CanvasItem per layer
    // and forwards `set_z_index` to it (`scene/2d/tile_map.cpp:279,376`), so a
    // layer is a canvas item in its own right: its key rides its GROUP, which
    // is what three reads a drawn object's position from.
    const zBucket = (o: THREE.Object3D) => Math.floor(nearestGroupOrder(o) / PAINT_SEQUENCE_STRIDE);
    expect(nearestGroupOrder(layer0!)).toBeLessThan(nearestGroupOrder(layer1!));
    // …and `layer_1/z_index = 1` puts that layer a whole z BUCKET up, which is
    // what lets it interleave with the TileMap's siblings rather than only with
    // the other layers. A rank shared across one canvas item cannot express it.
    expect(zBucket(layer1!)).toBe(zBucket(layer0!) + 1);
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
    const material = (r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
    expect(material.opacity).toBeCloseTo(0.5, 5);
  });
});
