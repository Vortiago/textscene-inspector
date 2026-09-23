/**
 * <GridMap> instances each MeshLibrary item's ArrayMesh at its populated cells,
 * one THREE.InstancedMesh per item. An unresolved mesh draws a cell-sized
 * wireframe box. The item's primary surface material covers the whole instanced
 * mesh, since most library tiles are single-surface.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from '../../../r3f/materials/godotDefaultMaterial';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../base/node3d/types';
import type { Vector3 } from '../../../parser/vectors';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { shadowCastingEffects } from '../../../r3f/shadowCasting';

/** Literal-only, so the key is constant and a placeholder cell never remounts. */
const PLACEHOLDER_CELL_MATERIAL = wireGizmoProgram(0x4488cc);

/**
 * Godot's default 3D material, for a tile whose ArrayMesh declares no material
 * or whose material is still loading: a MeshLibrary item has none of its own.
 * Module-level, shared and never disposed.
 */
const DEFAULT_TILE_MATERIAL = new THREE.MeshStandardMaterial({
  color: GODOT_DEFAULT_ALBEDO,
  metalness: GODOT_DEFAULT_METALLIC,
  roughness: GODOT_DEFAULT_ROUGHNESS,
});

/**
 * A SHADOWS_ONLY tile's material: it writes neither colour nor depth.
 * `visible = false` would also stop the tile casting, since three's
 * `WebGLShadowMap.renderObject` returns on it. Shared and never disposed.
 */
const SHADOWS_ONLY_TILE_MATERIAL = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
});

/** Godot Transform3D (basis rows + origin) → THREE.Matrix4. */
function transform3DToMatrix4(t: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.basis_x.x, t.basis_x.y, t.basis_x.z, t.origin.x,
    t.basis_y.x, t.basis_y.y, t.basis_y.z, t.origin.y,
    t.basis_z.x, t.basis_z.y, t.basis_z.z, t.origin.z,
    0, 0, 0, 1
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
    basis[0]!, basis[1]!, basis[2]!, 0,
    basis[3]!, basis[4]!, basis[5]!, 0,
    basis[6]!, basis[7]!, basis[8]!, 0,
    0, 0, 0, 1
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

/** All cells sharing one MeshLibrary item, batched into a single InstancedMesh. */
function GridMapItem({ item, cells, cellSize, cellCenter }: GridMapItemProps) {
  const meshResult = useResource<ArrayMeshResource>(item?.meshPath ?? '', 'arraymesh');
  // The surface material path only becomes known once the ArrayMesh resolves.
  const materialPath = meshResult.value?.materialPaths[0] ?? '';
  const materialResult = useResource<THREE.Material>(materialPath, 'material');

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

  const instanced = useMemo(() => {
    const geometry = meshResult.value?.geometry;
    if (!geometry) return null;
    // The resource pipeline owns the cached ArrayMesh and a resolved material.
    // The shared default stands in when none is loaded.
    const material = shadow.shadowsOnly
      ? SHADOWS_ONLY_TILE_MATERIAL
      : (materialPath && materialResult.value) || DEFAULT_TILE_MATERIAL;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow.castShadow;
    mesh.receiveShadow = true;
    // DOUBLE_SIDED reaches three's shared depth material here, per mesh per
    // light (`WebGLShadowMap.js:477,535,549`).
    mesh.onBeforeShadow = shadow.onBeforeShadow;
    return mesh;
  }, [meshResult.value, materialPath, materialResult.value, matrices, shadow]);

  // InstancedMesh.dispose() frees only its own instanceMatrix buffer, and leaves
  // the geometry and material the resource pipeline owns.
  useEffect(() => {
    if (!instanced) return;
    return () => instanced.dispose();
  }, [instanced]);

  if (instanced) {
    return <primitive object={instanced} />;
  }

  // A pending or missing item draws cell-sized wireframe boxes.
  return (
    <>
      {matrices.map((m, i) => (
        <PlaceholderCell key={i} matrix={m} cellSize={cellSize} />
      ))}
    </>
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
