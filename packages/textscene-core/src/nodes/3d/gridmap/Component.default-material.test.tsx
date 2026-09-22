/**
 * <GridMap> tiles whose ArrayMesh declares NO surface material.
 *
 * A MeshLibrary item carries only a mesh — the library has no material of its
 * own — so a material-less tile mesh reaches the renderer with a null material
 * and Godot binds the same hardcoded default shader it binds for any other
 * material-less surface. The tile's stand-in must therefore be that default,
 * not an arbitrary neutral grey.
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
const TILE_MESH_PATH = 'res://stage/meshes/bare.tres';

const LIBRARY_TRES = `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="ArrayMesh" path="${TILE_MESH_PATH}" id="1_bare"]

[resource]
item/0/name = "Bare"
item/0/mesh = ExtResource("1_bare")
`;

/** The same one-surface quad, with the `"material"` key omitted entirely. */
const TILE_MESH_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"name": "bare",
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

const EXT: TscnExternalResource[] = [{ id: '1_lib', path: LIBRARY_PATH, type: 'MeshLibrary' }];

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

async function renderTile() {
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
  // Chained loads: library .tres → tile .tres.
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((r) => setTimeout(r, 20));
    await renderer.update(tree);
  }
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
}

describe('<GridMap> tile whose ArrayMesh declares no material', () => {
  it('instances the tile once the mesh resolves', async () => {
    expect(await renderTile()).toHaveLength(1);
  });

  it('paints it with Godot’s default material', async () => {
    const material = (await renderTile())[0]!.material as THREE.MeshStandardMaterial;
    const rgb = material.color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(rgb.r).toBeCloseTo(0.6, 5);
    expect(rgb.g).toBeCloseTo(0.6, 5);
    expect(rgb.b).toBeCloseTo(0.6, 5);
    expect(material.roughness).toBe(0.8);
    expect(material.metalness).toBe(0.2);
  });
});
