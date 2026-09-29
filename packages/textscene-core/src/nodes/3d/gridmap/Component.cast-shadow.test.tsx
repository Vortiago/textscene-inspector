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
import { standardMaterial } from '../../../resources/materials/standardmaterial3d/testing/standardMaterial';
import {
  castsFrom,
  depthSideOf,
  drawColourGroup,
  drawsColour,
  TEST_CAMERA,
} from '../../../r3f/testing/threePasses';

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
    expect(depthSideOf(tile)).toBe(THREE.DoubleSide);
  });

  it('keeps the tile material’s own cull for every other value', async () => {
    // `render_forward_clustered.cpp:395-411`: only DOUBLE_SIDED drops the cull, and
    // every other value undoes three's acne flip (`WebGLShadowMap.js:51`).
    const tile = await renderTile('item/0/mesh_cast_shadow = 1');
    expect(depthSideOf(tile)).toBe(THREE.FrontSide);
  });

  it('SHADOWS_ONLY casts but draws no colour', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 3');
    expect(tile.castShadow).toBe(true);
    expect(drawsColour(tile)).toBe(false);
  });

  it('SHADOWS_ONLY keeps the tile material, so the shadow pass reads its own state', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 3');
    expect((tile.material as THREE.Material).colorWrite).toBe(true);
  });

  it('casts nothing from a tile whose material leaves the shadow pass', async () => {
    // Godot's per-surface FLAG_PASS_SHADOW (`render_forward_clustered.cpp:4078-4088`)
    // applies to a GridMap's tiles as to any GeometryInstance3D surface.
    const tile = await renderTile('');
    tile.material = standardMaterial({ transparency: '1' });
    expect(castsFrom(tile)).toBe(false);
  });

  it('never billboards a tile batch, which would turn about the GridMap origin', async () => {
    const tile = await renderTile('');
    tile.material = standardMaterial({ billboard_mode: '1' });
    tile.updateMatrixWorld(true);
    expect(drawColourGroup(tile, TEST_CAMERA, 0, (s) => s.matrixWorld).equals(tile.matrixWorld)).toBe(true);
  });

  it('never writes the tile’s setting onto the shared tile material', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 2');
    expect((tile.material as THREE.Material).shadowSide).toBeNull();
  });
});
