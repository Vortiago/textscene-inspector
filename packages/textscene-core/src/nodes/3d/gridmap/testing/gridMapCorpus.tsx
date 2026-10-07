/**
 * A GridMap over an in-memory MeshLibrary corpus: one item whose mesh is a
 * quad `.tres` of one or two surfaces, rendered until the chained loads settle.
 */
import type { ComponentType, ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnExternalResource, TscnNode } from '../../../../parser/types';
import { parseGridMap } from '../parser';
import { GridMap } from '../Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../index';
import { loaderServing } from '../../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';

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
 * The wall quad as the tile mesh. Its first surface declares a `[sub_resource]`
 * StandardMaterial3D with `materialLines` as its body, or no `"material"` key
 * when that is null. A `secondMaterialLines` adds a second surface with its own material.
 * `subResources` goes before them, for a material that names them.
 */
function tileMesh(
  materialLines: string | null,
  secondMaterialLines: string | null,
  subResources: string
): string {
  const first = {
    material: materialLines === null ? null : 'SubResource("StandardMaterial3D_tile")',
    name: 'tile',
  };
  const second =
    secondMaterialLines === null
      ? { text: '', surfaces: [] }
      : {
          text: surfaceMaterial('StandardMaterial3D_second', secondMaterialLines),
          surfaces: [{ material: 'SubResource("StandardMaterial3D_second")', name: 'second' }],
        };
  const firstText = materialLines === null ? '' : surfaceMaterial('StandardMaterial3D_tile', materialLines);
  return `[gd_resource type="ArrayMesh" format=4]

${subResources}${firstText}${second.text}[resource]
_surfaces = ${wallQuadSurfaces(first, ...second.surfaces)}
blend_shape_mode = 0
`;
}

function surfaceMaterial(id: string, lines: string): string {
  return `[sub_resource type="StandardMaterial3D" id="${id}"]\n${lines}\n\n`;
}

export interface GridMapCorpus {
  /** Extra `item/0/…` lines for the library, such as `mesh_cast_shadow`. */
  itemLines?: string;
  /** The tile material's body, or null for a surface with no material. */
  materialLines?: string | null;
  /** The body of a second surface's material, or null for a one-surface tile. */
  secondMaterialLines?: string | null;
  /** The body of the `cells` PackedInt32Array: three ints per cell. */
  cells?: string;
  /** `[sub_resource]` blocks the material names, such as a texture, written before it. */
  subResources?: string;
  /** Wraps the GridMap inside the providers, such as a tiled-upload queue. */
  wrapper?: ComponentType<{ children: ReactNode }>;
}

/** A mounted GridMap, for a test that changes something after the loads settle. */
export interface MountedGridMap {
  /** Every mesh the GridMap mounts now, with world matrices brought up to date. */
  tiles(): THREE.Mesh[];
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

/** Mounts the GridMap and waits until the library, the tile and its material resolve. */
export async function mountGridMap({
  itemLines = '',
  materialLines = null,
  secondMaterialLines = null,
  cells = '0, 0, 0',
  subResources = '',
  wrapper: Wrapper,
}: GridMapCorpus = {}): Promise<MountedGridMap> {
  const loader = loaderServing({
    [LIBRARY_PATH]: meshLibrary(itemLines),
    [TILE_MESH_PATH]: tileMesh(materialLines, secondMaterialLines, subResources),
  });

  const gridMap = <GridMap node={gridMapNode(cells)} />;
  const tree = (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
        {Wrapper ? <Wrapper>{gridMap}</Wrapper> : gridMap}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  // Three chained loads: library .tres → tile .tres → the tile's material.
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((r) => setTimeout(r, 20));
    await renderer.update(tree);
  }
  return {
    tiles: () => {
      const tiles = renderer.scene.findAllByType('Mesh').map((m) => instanceAs<THREE.Mesh>(m));
      // No frame has run, so the world matrices are brought up to date from the root.
      let root: THREE.Object3D | undefined = tiles[0];
      while (root?.parent) root = root.parent;
      root?.updateMatrixWorld(true);
      return tiles;
    },
  };
}

/** Every mesh the GridMap mounts once the library, the tile and its material resolve. */
export async function renderGridMapTiles(corpus: GridMapCorpus = {}): Promise<THREE.Mesh[]> {
  return (await mountGridMap(corpus)).tiles();
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
