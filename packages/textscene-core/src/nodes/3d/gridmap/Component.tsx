/**
 * <GridMap> instances each MeshLibrary item's mesh, an ArrayMesh or a PrimitiveMesh, at its
 * populated cells, through the surfaced mesh drawer: one THREE.InstancedMesh, or one THREE.Points
 * instanced at every cell for a PointMesh. A billboarding material turns each cell about its own
 * origin in its program. A loading item draws nothing.
 * An item whose mesh or library this previewer cannot read draws cell-sized wireframe boxes in one
 * InstancedMesh.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../../godot/scene/visualLayers';
import * as THREE from 'three';
import { nodeComponentRegistry, type NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { parseNodeWithRegistry } from '../../../core/NodeRegistry';
import type { TscnNode } from '../../../parser/types';
import { BakedMeshInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { Node3D } from '../../base/node3d/Component';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import { useMeshContent } from '../../../r3f/meshes/meshContent';
import { instancesAt } from '../../../r3f/surfacedMeshDrawer/meshInstances';
import { SurfacedMeshDrawer } from '../../../r3f/surfacedMeshDrawer/SurfacedMeshDrawer';
import { shadowCastingEffects } from '../../../r3f/shadowCasting';
import { usePathResolution } from '../../../resources/useSubOrExtResource';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../../godot/math/transform3d';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { transform3DToMatrix } from '../../../r3f/nodeTreeTransforms';
import { isLocalToScene } from '../../../resources/textures/viewporttexture/localToScene.js';

/** Where each cell sits in the grid, and how much its mesh scales. */
type CellGrid = Pick<GridMapProperties, 'cellSize' | 'cellCenter' | 'cellScale'>;

/** Literal-only, so the key is constant and the placeholder batch never remounts its material. */
const PLACEHOLDER_TILE_MATERIAL = wireGizmoProgram(0x4488cc);

/** Written only by `cellMatrix`. `Matrix4.scale` reads it at once, so a large grid allocates none. */
const cellScaleVector = new THREE.Vector3();

/**
 * A cell's place: translate(cell·size + centering offset). The offset is Godot's `_get_offset()`:
 * `cell_size * 0.5` on each axis whose `cell_center_*` is on, all three by default. Without it the
 * tiles sit half a cell off from sibling nodes.
 */
function cellOrigin(cell: GridMapCell, { cellSize, cellCenter }: Omit<CellGrid, 'cellScale'>): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(
    cell.x * cellSize.x + (cellCenter.x ? cellSize.x * 0.5 : 0),
    cell.y * cellSize.y + (cellCenter.y ? cellSize.y * 0.5 : 0),
    cell.z * cellSize.z + (cellCenter.z ? cellSize.z * 0.5 : 0)
  );
}

/**
 * World matrix for one cell: its place × scale(cell_scale) × orientation × meshTransform
 * (`modules/gridmap/grid_map.cpp:685-687,696`).
 */
function cellMatrix(cell: GridMapCell, grid: CellGrid, meshTransform: Transform3D | null): THREE.Matrix4 {
  const basis = ORTHO_BASES[cell.rot] ?? ORTHO_BASES[0]!;
  const orient = new THREE.Matrix4().set(
    basis[0]!,
    basis[1]!,
    basis[2]!,
    0,
    basis[3]!,
    basis[4]!,
    basis[5]!,
    0,
    basis[6]!,
    basis[7]!,
    basis[8]!,
    0,
    0,
    0,
    0,
    1
  );
  const matrix = cellOrigin(cell, grid);
  matrix.scale(cellScaleVector.setScalar(grid.cellScale)).multiply(orient);
  if (meshTransform) matrix.multiply(transform3DToMatrix(meshTransform));
  return matrix;
}

export function GridMap({ node, children }: NodeComponentProps) {
  const properties = node.properties as GridMapProperties;
  const library = useMeshLibraryModel(properties.meshLibrary);
  const isMeshHeldLocally = !library.resource || isLocalToScene(library.resource);

  const cellsByItem = useMemo(() => {
    const grouped = new Map<number, GridMapCell[]>();
    for (const cell of decodeGridMapCells(properties.cells ?? '')) {
      const list = grouped.get(cell.item);
      if (list) list.push(cell);
      else grouped.set(cell.item, [cell]);
    }
    return grouped;
  }, [properties.cells]);

  // Godot draws no cell while the GridMap holds baked meshes (`modules/gridmap/grid_map.cpp:688`).
  const hasBakedMeshes = properties.bakedMeshes.length > 0;
  const items = library.status === 'pending' || hasBakedMeshes ? [] : Array.from(cellsByItem.entries());
  const gridProps = {
    cellSize: properties.cellSize,
    cellCenter: properties.cellCenter,
    cellScale: properties.cellScale,
  };
  return (
    <Node3D node={node}>
      {hasBakedMeshes && <BakedMeshes refs={properties.bakedMeshes} />}
      {items.map(([itemId, cells]) => {
        // A library this previewer cannot load draws each cell's placeholder instead.
        if (!library.model) return <PlaceholderTiles key={itemId} cells={cells} {...gridProps} />;
        const item = library.model.get(itemId);
        // Godot draws a cell only for an item the library holds with a mesh (`:676-678,689`).
        if (!item?.meshPath) return null;
        return (
          <GridMapItem
            key={itemId}
            item={item}
            isMeshHeldLocally={isMeshHeldLocally}
            cells={cells}
            {...gridProps}
          />
        );
      })}
      {children}
    </Node3D>
  );
}

/**
 * Each baked mesh as the instance Godot gives it at the GridMap's own transform
 * (`grid_map.cpp:97-104`, `:1037-1039`), drawn as a MeshInstance3D of that mesh would be. A
 * LightmapGI names each by its index (`lightmap_gi.cpp:1544-1550`).
 */
function BakedMeshes({ refs }: { refs: readonly string[] }) {
  const nodes = useMemo(() => refs.map(bakedMeshNode), [refs]);
  const MeshInstance3D = nodeComponentRegistry.get(MESH_INSTANCE_TYPE);
  if (!MeshInstance3D) return null;
  return (
    <>
      {nodes.map((meshNode, index) => (
        <BakedMeshInstance key={index} value={index}>
          <MeshInstance3D node={meshNode} />
        </BakedMeshInstance>
      ))}
    </>
  );
}

const MESH_INSTANCE_TYPE = 'MeshInstance3D';

/** A MeshInstance3D of the baked mesh `ref`, with every other property at its default. */
function bakedMeshNode(ref: string, index: number): TscnNode {
  const heading = { type: 'node', attributes: { type: MESH_INSTANCE_TYPE, name: `BakedMesh${index}` } };
  const node = parseNodeWithRegistry(heading, { mesh: ref });
  if (!node) throw new Error(`expected the ${MESH_INSTANCE_TYPE} parser to be registered, got none`);
  return node;
}

interface GridMapItemProps extends CellGrid {
  item: MeshLibraryItem;
  /** The library, which holds the item's mesh for its materials' local-to-scene setup. */
  isMeshHeldLocally: boolean;
  cells: GridMapCell[];
}

/**
 * All cells sharing one MeshLibrary item, each part of its mesh as one instanced draw, which Godot
 * billboards per instance in its shader (`scene_forward_clustered.glsl:338-342`).
 */
function GridMapItem({ item, isMeshHeldLocally, cells, cellSize, cellCenter, cellScale }: GridMapItemProps) {
  const content = useMeshContent(usePathResolution(item.meshPath), isMeshHeldLocally);

  // `cellCenter` is compared by identity: the parser hands back one shared
  // frozen instance for the all-centered default, so re-parsing an unchanged
  // file (every debounced keystroke) does not rebuild every cell's matrix.
  const matrices = useMemo(() => {
    const grid = { cellSize, cellCenter, cellScale };
    return cells.map((cell) => cellMatrix(cell, grid, item.meshTransform));
  }, [cells, cellSize, cellCenter, cellScale, item.meshTransform]);

  const instances = useMemo(() => instancesAt(matrices), [matrices]);
  // GridMap is no GeometryInstance3D. Godot gives each tile an instance of its own, whose
  // `cast_shadow` the library holds (`modules/gridmap/grid_map.cpp:799-800`).
  const owner = useMemo(
    () => ({ shadow: shadowCastingEffects(item.castShadow), layers: GODOT_DEFAULT_VISUAL_LAYERS }),
    [item.castShadow]
  );

  // Godot draws the mesh, so a mesh this previewer cannot read shows the placeholder.
  if (content.kind === 'unresolved') {
    return <PlaceholderTiles cells={cells} cellSize={cellSize} cellCenter={cellCenter} />;
  }
  if (content.kind !== 'surfaced') return null;
  return <SurfacedMeshDrawer parts={content.mesh.parts} instances={instances} owner={owner} />;
}

/**
 * A cell-sized wireframe box at each cell's place, all in one draw, so a missing item in a large
 * grid costs one draw as its tiles would.
 */
function PlaceholderTiles({
  cells,
  cellSize,
  cellCenter,
}: { cells: GridMapCell[] } & Omit<CellGrid, 'cellScale'>) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(
    () => cells.map((cell) => cellOrigin(cell, { cellSize, cellCenter })),
    [cells, cellSize, cellCenter]
  );
  useLayoutEffect(() => writeInstanceMatrices(meshRef.current, matrices), [matrices]);
  return (
    <instancedMesh key={matrices.length} ref={meshRef} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={[cellSize.x, cellSize.y, cellSize.z]} />
      <meshBasicMaterial key={PLACEHOLDER_TILE_MATERIAL.key} {...PLACEHOLDER_TILE_MATERIAL.props} />
    </instancedMesh>
  );
}

/** Sets each instance of `mesh` to its matrix. A mesh not yet mounted waits for the next call. */
function writeInstanceMatrices(mesh: THREE.InstancedMesh | null, matrices: THREE.Matrix4[]): void {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  // three computes these once and culls by them, so a moved cell would stay culled at its old place.
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
}
