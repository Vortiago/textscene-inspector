/**
 * <GridMap> instances each MeshLibrary item's ArrayMesh at its populated cells,
 * one THREE.InstancedMesh per item, or one mesh per cell when a surface material
 * billboards. An unresolved mesh draws a cell-sized wireframe box.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import type { MaterialSource } from '../../../r3f/materials/materialSource';
import { useMaterialScalars } from '../../../r3f/materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots } from '../../../r3f/materials/SurfaceMaterialSlots';
import { readyMaterial, useMaterial } from '../../../r3f/materials/useMaterial';
import { surfaceBillboard } from '../../../resources/materials/standardmaterial3d/materialBag';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../base/node3d/types';
import type { Vector3 } from '../../../parser/vectors';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { shadowCastingEffects, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { drawsAsOneBatch } from '../../../r3f/surfaceDrawHooks';

/** Literal-only, so the key is constant and a placeholder cell never remounts. */
const PLACEHOLDER_CELL_MATERIAL = wireGizmoProgram(0x4488cc);

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

  return (
    <Node3D node={node}>
      {Array.from(cellsByItem.entries()).map(([itemId, cells]) => (
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

/** All cells sharing one MeshLibrary item: one batch, or one tile per cell when it billboards. */
function GridMapItem({ item, cells, cellSize, cellCenter }: GridMapItemProps) {
  const meshResult = useResource<ArrayMeshResource>(item?.meshPath ?? '', 'arraymesh');
  // The surface material addresses only become known once the ArrayMesh resolves.
  const materialPaths = meshResult.value?.materialPaths;
  const materials = useMemo(() => surfaceMaterials(materialPaths ?? []), [materialPaths]);

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

  const geometry = meshResult.value?.geometry;
  if (!geometry) {
    // A pending or missing item draws cell-sized wireframe boxes.
    return (
      <>
        {matrices.map((m, i) => (
          <PlaceholderCell key={i} matrix={m} cellSize={cellSize} />
        ))}
      </>
    );
  }
  return (
    <SurfaceBatchScan
      geometry={geometry}
      materials={materials}
      matrices={matrices}
      shadow={shadow}
      surface={0}
      isBatchable
    />
  );
}

/** One source per draw group, and one for Godot's default surface when the mesh declares none. */
function surfaceMaterials(materialPaths: readonly (string | null)[]): (MaterialSource | undefined)[] {
  if (materialPaths.length === 0) return [undefined];
  return materialPaths.map((path) => (path ? { kind: 'file', path } : undefined));
}

interface TileProps {
  geometry: THREE.BufferGeometry;
  /** One per draw group. Undefined while the ArrayMesh loads or when a surface declares none. */
  materials: readonly (MaterialSource | undefined)[];
  shadow: ShadowCastingEffects;
}

interface ItemTilesProps extends TileProps {
  matrices: THREE.Matrix4[];
}

/**
 * The item's tiles, batched only when no surface billboards. Reads whether `surface` draws as
 * one batch, hands on to the next surface, and draws the tiles after the last: a hook per
 * surface cannot sit in a loop. The decoded material decides, as the drawn one exists only in a slot.
 */
function SurfaceBatchScan({
  surface,
  isBatchable,
  ...props
}: ItemTilesProps & { surface: number; isBatchable: boolean }) {
  const scalars = useMaterialScalars(readyMaterial(useMaterial(props.materials[surface])));
  const isBatchableSoFar = isBatchable && drawsAsOneBatch(surfaceBillboard(scalars));
  if (surface + 1 < props.materials.length) {
    return <SurfaceBatchScan {...props} surface={surface + 1} isBatchable={isBatchableSoFar} />;
  }
  if (isBatchableSoFar) return <BatchedTiles {...props} />;
  return (
    <>
      {props.matrices.map((m, i) => (
        <CellTile
          key={i}
          geometry={props.geometry}
          materials={props.materials}
          matrix={m}
          shadow={props.shadow}
        />
      ))}
    </>
  );
}

/**
 * Every cell as one InstancedMesh, keyed on the count: three sizes the instance buffer at
 * construction. The resource pipeline owns the geometry, which R3F leaves alone since it
 * arrives through `args`. The shadow hooks carry DOUBLE_SIDED and SHADOWS_ONLY per draw
 * (`r3f/surfaceDrawHooks.ts`).
 */
function BatchedTiles({ geometry, materials, matrices, shadow }: ItemTilesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, geometry]);

  return (
    <instancedMesh
      key={matrices.length}
      ref={meshRef}
      args={[geometry, undefined, matrices.length]}
      castShadow={shadow.castShadow}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
    >
      <SurfaceMaterialSlots sources={materials} />
    </instancedMesh>
  );
}

/**
 * One cell of a billboarding item, so its tile turns about its own cell as in Godot
 * (`drawsAsOneBatch` says why a batch cannot). Each cell mounts its own slots, since a
 * material element attaches to one parent. Every such material shares one program.
 */
function CellTile({ geometry, materials, matrix, shadow }: TileProps & { matrix: THREE.Matrix4 }) {
  return (
    <mesh
      args={[geometry]}
      matrix={matrix}
      matrixAutoUpdate={false}
      castShadow={shadow.castShadow}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
    >
      <SurfaceMaterialSlots sources={materials} />
    </mesh>
  );
}

function PlaceholderCell({ matrix, cellSize }: { matrix: THREE.Matrix4; cellSize: Vector3 }) {
  const position = useMemo((): [number, number, number] => {
    const v = new THREE.Vector3().setFromMatrixPosition(matrix);
    return [v.x, v.y, v.z];
  }, [matrix]);
  return (
    <mesh position={position}>
      <boxGeometry args={[cellSize.x, cellSize.y, cellSize.z]} />
      <meshBasicMaterial key={PLACEHOLDER_CELL_MATERIAL.key} {...PLACEHOLDER_CELL_MATERIAL.props} />
    </mesh>
  );
}
