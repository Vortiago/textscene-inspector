/**
 * <GridMap> honours the MeshLibrary's per-tile `mesh_cast_shadow`. GridMap has
 * no `cast_shadow` of its own: it applies the library's setting to each item's
 * instance (`modules/gridmap/grid_map.cpp:799-800`).
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

/** One-surface quad with no material: the tile's material is not under test. */
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

function library(castShadowLine: string): string {
  return `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="ArrayMesh" path="${TILE_MESH_PATH}" id="1_bare"]

[resource]
item/0/name = "Bare"
item/0/mesh = ExtResource("1_bare")
${castShadowLine}
`;
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

async function renderTile(castShadowLine: string): Promise<THREE.InstancedMesh> {
  const files = new Map([
    [LIBRARY_PATH, library(castShadowLine)],
    [TILE_MESH_PATH, TILE_MESH_TRES],
  ]);
  const provider: ResourceProvider = {
    async loadResource(path: string) {
      return files.get(path) ?? null;
    },
  };
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
  const instanced = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
  expect(instanced).toHaveLength(1);
  return instanced[0]!;
}

/** three's shadow pass: the side, then the per-object hook (`WebGLShadowMap.js:477,535,549`). */
function depthSideAfterPass(mesh: THREE.Object3D, material: THREE.Material): THREE.Side {
  const flip: Record<number, THREE.Side> = {
    [THREE.FrontSide]: THREE.BackSide,
    [THREE.BackSide]: THREE.FrontSide,
    [THREE.DoubleSide]: THREE.DoubleSide,
  };
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.side = material.shadowSide ?? flip[material.side as number]!;
  mesh.onBeforeShadow(
    null as never, new THREE.Scene(), null as never, null as never,
    new THREE.BufferGeometry(), depthMaterial, null as never
  );
  return depthMaterial.side;
}

describe('<GridMap> per-tile mesh_cast_shadow', () => {
  it('casts by default, as Godot does with the key absent', async () => {
    const tile = await renderTile('');
    expect(tile.castShadow).toBe(true);
    expect(tile.receiveShadow).toBe(true);
  });

  it('OFF stops that tile casting', async () => {
    expect((await renderTile('item/0/mesh_cast_shadow = 0')).castShadow).toBe(false);
  });

  it('DOUBLE_SIDED draws both faces into the depth pass', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 2');
    expect(tile.castShadow).toBe(true);
    expect(depthSideAfterPass(tile, tile.material as THREE.Material)).toBe(THREE.DoubleSide);
  });

  it('leaves three’s flip alone for every other value', async () => {
    // `render_forward_clustered.cpp:395-411`: only DOUBLE_SIDED drops the cull.
    const tile = await renderTile('item/0/mesh_cast_shadow = 1');
    expect(depthSideAfterPass(tile, tile.material as THREE.Material)).toBe(THREE.BackSide);
  });

  it('SHADOWS_ONLY casts but writes no colour', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 3');
    expect(tile.castShadow).toBe(true);
    expect((tile.material as THREE.Material).colorWrite).toBe(false);
  });

  it('never writes the tile’s setting onto the shared tile material', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 2');
    expect((tile.material as THREE.Material).shadowSide).toBeNull();
  });
});
