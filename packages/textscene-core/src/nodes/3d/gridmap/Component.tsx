/**
 * <GridMap> instances each MeshLibrary item's mesh, an ArrayMesh or a PrimitiveMesh, at its
 * populated cells. Each surface draws as one THREE.InstancedMesh, or as one mesh per cell when
 * its material billboards. A loading item draws nothing, and an unresolved one draws cell-sized
 * wireframe boxes in one InstancedMesh.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import type { MaterialSource } from '../../../r3f/materials/materialSource';
import { useItemMesh } from './itemMesh';
import { SurfaceMaterialSlot, useMaterialScalars } from '../../../r3f/materials/SurfaceMaterialSlot';
import { surfaceAttach, surfaceSources } from '../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../r3f/materials/useOneSurfaceStartingMaterial';
import { readyMaterial, useMaterial } from '../../../r3f/materials/useMaterial';
import { surfaceBillboard } from '../../../resources/materials/standardmaterial3d/materialBag';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../../godot/math/transform3d';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { shadowCastingEffects, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { drawsAsOneBatch } from '../../../r3f/surfaceDrawHooks';
import type { Vector3 } from '../../../godot/math/vector';

/** Literal-only, so the key is constant and the placeholder batch never remounts its material. */
const PLACEHOLDER_TILE_MATERIAL = wireGizmoProgram(0x4488cc);

/** Godot Transform3D (basis rows + origin) → THREE.Matrix4. */
function transform3DToMatrix4(t: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.basis_x.x,
    t.basis_x.y,
    t.basis_x.z,
    t.origin.x,
    t.basis_y.x,
    t.basis_y.y,
    t.basis_y.z,
    t.origin.y,
    t.basis_z.x,
    t.basis_z.y,
    t.basis_z.z,
    t.origin.z,
    0,
    0,
    0,
    1
  );
}

/**
 * World matrix for one cell: translate(cell·size + centering offset) ×
 * orientation × meshTransform. The offset is Godot's `_get_offset()`:
 * `cell_size * 0.5` on each axis whose `cell_center_*` is on, all three by
 * default. Without it the tiles sit half a cell off from sibling nodes.
 */
function cellMatrix(
  cell: GridMapCell,
  cellSize: Vector3,
  cellCenter: GridMapProperties['cellCenter'],
  meshTransform: Transform3D | null
): THREE.Matrix4 {
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
  const matrix = new THREE.Matrix4().makeTranslation(
    cell.x * cellSize.x + (cellCenter.x ? cellSize.x * 0.5 : 0),
    cell.y * cellSize.y + (cellCenter.y ? cellSize.y * 0.5 : 0),
    cell.z * cellSize.z + (cellCenter.z ? cellSize.z * 0.5 : 0)
  );
  matrix.multiply(orient);
  if (meshTransform) matrix.multiply(transform3DToMatrix4(meshTransform));
  return matrix;
}

export function GridMap({ node, children }: NodeComponentProps) {
  const properties = node.properties as GridMapProperties;
  const library = useMeshLibraryModel(properties.meshLibrary);

  const cellsByItem = useMemo(() => {
    const grouped = new Map<number, GridMapCell[]>();
    for (const cell of decodeGridMapCells(properties.cells ?? '')) {
      const list = grouped.get(cell.item);
      if (list) list.push(cell);
      else grouped.set(cell.item, [cell]);
    }
    return grouped;
  }, [properties.cells]);

  // Godot draws a cell only once its library holds the item (`modules/gridmap/grid_map.cpp:676-678`).
  const items = library.status === 'pending' ? [] : Array.from(cellsByItem.entries());
  return (
    <Node3D node={node}>
      {items.map(([itemId, cells]) => (
        <GridMapItem
          key={itemId}
          item={library.model?.get(itemId) ?? null}
          cells={cells}
          cellSize={properties.cellSize}
          cellCenter={properties.cellCenter}
        />
      ))}
      {children}
    </Node3D>
  );
}

interface GridMapItemProps {
  item: MeshLibraryItem | null;
  cells: GridMapCell[];
  cellSize: Vector3;
  cellCenter: GridMapProperties['cellCenter'];
}

/**
 * All cells sharing one MeshLibrary item. Each surface decides on its own whether it batches,
 * as Godot billboards each surface's instances in its own shader (`scene_forward_clustered.glsl:338-342`).
 */
function GridMapItem({ item, cells, cellSize, cellCenter }: GridMapItemProps) {
  const mesh = useItemMesh(item?.meshPath ?? null);

  // `cellCenter` is compared by identity: the parser hands back one shared
  // frozen instance for the all-centered default, so re-parsing an unchanged
  // file (every debounced keystroke) does not rebuild every cell's matrix.
  const matrices = useMemo(
    () => cells.map((cell) => cellMatrix(cell, cellSize, cellCenter, item?.meshTransform ?? null)),
    [cells, cellSize, cellCenter, item?.meshTransform]
  );

  // GridMap has no `cast_shadow` of its own. The setting is per tile, read off
  // the library (`modules/gridmap/grid_map.cpp:799-800`).
  const shadow = shadowCastingEffects(item?.castShadow);

  // Godot draws a cell only once its item has a mesh (`modules/gridmap/grid_map.cpp:688`).
  if (mesh.status === 'unavailable') return <PlaceholderTiles matrices={matrices} cellSize={cellSize} />;
  if (mesh.status !== 'loaded') return null;
  const { geometry } = mesh;
  const surfaces = surfaceSources(mesh.materials);
  return (
    <>
      {surfaces.map((source, surface) => (
        <GridMapSurface
          key={surface}
          draw={{ geometry, source, surface, surfaceCount: surfaces.length, shadow }}
          matrices={matrices}
        />
      ))}
    </>
  );
}

/** One surface of an item's mesh, drawn on its own. */
interface SurfaceDraw {
  geometry: THREE.BufferGeometry;
  /** Undefined for a surface that names no material: Godot's default surface. */
  source: MaterialSource | undefined;
  /** The draw group this draw owns. */
  surface: number;
  surfaceCount: number;
  shadow: ShadowCastingEffects;
}

/**
 * Every cell of one surface: one batch, or one tile per cell when its material billboards.
 * The decoded material decides, as the drawn one exists only inside a slot.
 */
function GridMapSurface({ draw, matrices }: { draw: SurfaceDraw; matrices: THREE.Matrix4[] }) {
  const scalars = useMaterialScalars(readyMaterial(useMaterial(draw.source)));
  if (drawsAsOneBatch(surfaceBillboard(scalars))) return <BatchedTiles draw={draw} matrices={matrices} />;
  return (
    <>
      {matrices.map((m, i) => (
        <CellTile key={i} draw={draw} matrix={m} />
      ))}
    </>
  );
}

/**
 * Every cell as one InstancedMesh, keyed on the count: three sizes the instance buffer at
 * construction. `useItemMesh` owns the geometry, which R3F leaves alone since it arrives
 * through `args`. The shadow hooks carry DOUBLE_SIDED and SHADOWS_ONLY per draw
 * (`r3f/surfaceDrawHooks.ts`).
 */
function BatchedTiles({ draw, matrices }: { draw: SurfaceDraw; matrices: THREE.Matrix4[] }) {
  const { geometry, shadow } = draw;
  const startingMaterial = useOneSurfaceStartingMaterial(draw.surfaceCount);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Every arg is a dependency: a changed arg rebuilds the mesh with identity instance matrices.
  useLayoutEffect(
    () => writeInstanceMatrices(meshRef.current, matrices),
    [matrices, geometry, startingMaterial]
  );

  return (
    <instancedMesh
      key={matrices.length}
      ref={meshRef}
      args={[geometry, startingMaterial, matrices.length]}
      castShadow={shadow.castShadow}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
    >
      <OwnedSurfaceSlot draw={draw} />
    </instancedMesh>
  );
}

/**
 * One cell of a billboarding surface, so its tile turns about its own cell as in Godot
 * (`drawsAsOneBatch` says why a batch cannot). Each cell mounts its own slot, since a
 * material element attaches to one parent. Every such material shares one program.
 */
function CellTile({ draw, matrix }: { draw: SurfaceDraw; matrix: THREE.Matrix4 }) {
  const { geometry, shadow } = draw;
  const startingMaterial = useOneSurfaceStartingMaterial(draw.surfaceCount);
  return (
    <mesh
      args={[geometry, startingMaterial]}
      matrix={matrix}
      matrixAutoUpdate={false}
      castShadow={shadow.castShadow}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
    >
      <OwnedSurfaceSlot draw={draw} />
    </mesh>
  );
}

/** The material of the one draw group a surface draw owns. */
function OwnedSurfaceSlot({ draw }: { draw: SurfaceDraw }) {
  return <SurfaceMaterialSlot source={draw.source} attach={surfaceAttach(draw.surface, draw.surfaceCount)} />;
}

/**
 * A cell-sized wireframe box at each cell's centre, all in one draw, so a missing item in a large
 * grid costs one draw as its tiles would.
 */
function PlaceholderTiles({ matrices, cellSize }: { matrices: THREE.Matrix4[]; cellSize: Vector3 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => writeInstanceMatrices(meshRef.current, matrices, cellCentre), [matrices]);
  return (
    <instancedMesh key={matrices.length} ref={meshRef} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={[cellSize.x, cellSize.y, cellSize.z]} />
      <meshBasicMaterial key={PLACEHOLDER_TILE_MATERIAL.key} {...PLACEHOLDER_TILE_MATERIAL.props} />
    </instancedMesh>
  );
}

/** Written only by `cellCentre`. `copyPosition` leaves its basis at identity. */
const centreMatrix = new THREE.Matrix4();

/** A cell matrix's translation alone, in one shared matrix, so a large grid allocates none. */
function cellCentre(matrix: THREE.Matrix4): THREE.Matrix4 {
  return centreMatrix.copyPosition(matrix);
}

/**
 * Sets each instance of `mesh` to `place` of its matrix. A mesh not yet mounted waits for the next
 * call. `setMatrixAt` copies, so `place` may return one reused matrix.
 */
function writeInstanceMatrices(
  mesh: THREE.InstancedMesh | null,
  matrices: THREE.Matrix4[],
  place: (matrix: THREE.Matrix4) => THREE.Matrix4 = (matrix) => matrix
): void {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, place(m)));
  mesh.instanceMatrix.needsUpdate = true;
  // three computes these once and culls by them, so a moved cell would stay culled at its old place.
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
}
