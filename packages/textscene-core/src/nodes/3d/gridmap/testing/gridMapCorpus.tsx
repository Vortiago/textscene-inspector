/**
 * A GridMap over an in-memory MeshLibrary corpus: one item whose mesh is a
 * one-surface quad `.tres`, rendered until the chained loads settle.
 */
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnExternalResource, TscnNode } from '../../../../parser/types';
import { parseGridMap } from '../parser';
import { GridMap } from '../Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../../index';
import type { ResourceProvider } from '../../../../resources/ResourceProvider';

const LIBRARY_PATH = 'res://stage/tiles.tres';
const TILE_MESH_PATH = 'res://stage/meshes/tile.tres';

/** A library whose item 0 is the tile mesh, plus any further `item/0/…` lines. */
function meshLibrary(itemLines: string): string {
  return `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="ArrayMesh" path="${TILE_MESH_PATH}" id="1_tile"]

[resource]
item/0/name = "Tile"
item/0/mesh = ExtResource("1_tile")
${itemLines}
`;
}

/**
 * The tile quad. Its surface declares a `[sub_resource]` StandardMaterial3D
 * with `materialLines` as its body, or no `"material"` key when that is null.
 */
function tileMesh(materialLines: string | null): string {
  const material =
    materialLines === null
      ? ''
      : `[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_tile"]\n${materialLines}\n\n`;
  const materialKey =
    materialLines === null ? '' : `"material": SubResource("StandardMaterial3D_tile"),\n`;
  return `[gd_resource type="ArrayMesh" format=4]

${material}[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
${materialKey}"name": "tile",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;
}

export interface GridMapCorpus {
  /** Extra `item/0/…` lines for the library, such as `mesh_cast_shadow`. */
  itemLines?: string;
  /** The tile material's body, or null for a surface with no material. */
  materialLines?: string | null;
  /** The body of the `cells` PackedInt32Array: three ints per cell. */
  cells?: string;
}

const EXT: TscnExternalResource[] = [{ id: '1_lib', path: LIBRARY_PATH, type: 'MeshLibrary' }];

function gridMapNode(cells: string): TscnNode {
  return {
    name: 'MyGridMap',
    type: 'GridMap',
    children: [],
    properties: parseGridMap(
      { type: 'node', attributes: { type: 'GridMap', name: 'MyGridMap' } },
      {
        mesh_library: 'ExtResource("1_lib")',
        data: `{"cells": PackedInt32Array(${cells})}`,
      }
    ),
  };
}

/** Every mesh the GridMap mounts once the library, the tile and its material resolve. */
export async function renderGridMapTiles({
  itemLines = '',
  materialLines = null,
  cells = '0, 0, 0',
}: GridMapCorpus = {}): Promise<THREE.Mesh[]> {
  const files = new Map([
    [LIBRARY_PATH, meshLibrary(itemLines)],
    [TILE_MESH_PATH, tileMesh(materialLines)],
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
        <GridMap node={gridMapNode(cells)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  // Three chained loads: library .tres → tile .tres → the tile's material.
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((r) => setTimeout(r, 20));
    await renderer.update(tree);
  }
  const tiles = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
  // No frame has run, so the world matrices are brought up to date from the root.
  let root: THREE.Object3D | undefined = tiles[0];
  while (root?.parent) root = root.parent;
  root?.updateMatrixWorld(true);
  return tiles;
}

/** The one InstancedMesh a non-billboarded item batches into, or a thrown error. */
export async function renderInstancedTile(corpus: GridMapCorpus = {}): Promise<THREE.InstancedMesh> {
  const instanced = (await renderGridMapTiles(corpus)).filter(
    (o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh
  );
  if (instanced.length !== 1) {
    throw new Error(`expected one instanced tile batch, got ${instanced.length}`);
  }
  return instanced[0]!;
}
