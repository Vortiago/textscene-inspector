/**
 * <GridMap> tiles whose ArrayMesh `.tres` carries its OWN surface material as a
 * `[sub_resource]`.
 *
 * This is the reuse check for the **Sub-resource path** seam: GridMap already
 * feeds `ArrayMeshResource.materialPaths[0]` straight into
 * `useResource(path, 'StandardMaterial3D')`, so it picks the third kind of
 * reference up with NO change of its own. If that stops being true, the seam has
 * grown a per-consumer special case and this goes red while
 * `Component.arraymesh.test.tsx` stays green.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import { parseGridMap } from './parser';
import { GridMap } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';

const LIBRARY_PATH = 'res://stage/tiles.tres';
const TILE_MESH_PATH = 'res://stage/meshes/floor.tres';

const LIBRARY_TRES = `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="ArrayMesh" path="${TILE_MESH_PATH}" id="1_floor"]

[resource]
item/0/name = "Floor"
item/0/mesh = ExtResource("1_floor")
`;

/** A one-surface quad whose material is a sub-resource of this same file. */
const TILE_MESH_TRES = `[gd_resource type="ArrayMesh" format=4]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_floor"]
albedo_color = Color(0, 1, 0, 1)
roughness = 0.25

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": SubResource("StandardMaterial3D_floor"),
"name": "floor",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

class CorpusProvider implements ResourceProvider {
  private files = new Map([
    [LIBRARY_PATH, LIBRARY_TRES],
    [TILE_MESH_PATH, TILE_MESH_TRES],
  ]);
  async loadResource(path: string): Promise<string | ArrayBuffer | null> {
    return this.files.get(path) ?? null;
  }
}

const EXT: TscnExternalResource[] = [
  { id: '1_lib', path: LIBRARY_PATH, type: 'MeshLibrary' },
];

function gridMapNode(): TscnNode {
  return {
    name: 'MyGridMap',
    type: 'GridMap',
    children: [],
    properties: parseGridMap(
      { type: 'node', attributes: { type: 'GridMap', name: 'MyGridMap' } },
      {
        mesh_library: 'ExtResource("1_lib")',
        data: '{"cells": PackedInt32Array(0, 0, 0)}',
      }
    ),
  };
}

describe('<GridMap> tile with the ArrayMesh’s own surface material', () => {
  it('tints the instanced tile with the material inside the tile mesh’s .tres', async () => {
    const provider = new CorpusProvider();
    const loader = new ResourceLoader(new FileEventBus(provider));
    loader.setProvider(provider);

    const tree = (
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
          <GridMap node={gridMapNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);
    // Three chained loads: library .tres → tile .tres → the tile's material.
    for (let i = 0; i < 12; i++) {
      await new Promise<void>((r) => setTimeout(r, 20));
      await renderer.update(tree);
    }

    const instanced = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance)
      .filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
    expect(instanced).toHaveLength(1);
    const material = instanced[0]!.material as THREE.MeshStandardMaterial;
    // Straight off the sub-resource body: Color(0, 1, 0, 1) and roughness 0.25.
    expect(material.color.getHex()).toBe(0x00ff00);
    expect(material.roughness).toBe(0.25);
  });
});
