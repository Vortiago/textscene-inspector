/**
 * <GridMap> — renders a Godot GridMap by instancing MeshLibrary item meshes at
 * each populated cell. Cells are decoded from the packed int stream; each cell
 * places its item's ArrayMesh, oriented by one of the 24 orthogonal bases and
 * positioned at `cell · cell_size`. Cells of the same item are batched into one
 * THREE.InstancedMesh. Items whose mesh hasn't resolved fall back to a
 * cell-sized wireframe box so the level's structure is still visible.
 *
 * Material parity is first-pass: the item's primary surface material is applied
 * to the whole instanced mesh (most library tiles are single-surface).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/meshLibraryModel';
import type { Transform3D } from '../../base/node3d/types';
import type { Vector3 } from '../../../parser/vectors';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';

/** Godot Transform3D (basis rows + origin) → THREE.Matrix4. */
function transform3DToMatrix4(t: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.basis_x.x, t.basis_x.y, t.basis_x.z, t.origin.x,
    t.basis_y.x, t.basis_y.y, t.basis_y.z, t.origin.y,
    t.basis_z.x, t.basis_z.y, t.basis_z.z, t.origin.z,
    0, 0, 0, 1
  );
}

/** World matrix for one cell: translate(cell·size) × orientation × meshTransform. */
function cellMatrix(cell: GridMapCell, cellSize: Vector3, meshTransform: Transform3D | null): THREE.Matrix4 {
  const basis = ORTHO_BASES[cell.rot] ?? ORTHO_BASES[0]!;
  const orient = new THREE.Matrix4().set(
    basis[0]!, basis[1]!, basis[2]!, 0,
    basis[3]!, basis[4]!, basis[5]!, 0,
    basis[6]!, basis[7]!, basis[8]!, 0,
    0, 0, 0, 1
  );
  const matrix = new THREE.Matrix4().makeTranslation(
    cell.x * cellSize.x,
    cell.y * cellSize.y,
    cell.z * cellSize.z
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
}

/** All cells sharing one MeshLibrary item, batched into a single InstancedMesh. */
function GridMapItem({ item, cells, cellSize }: GridMapItemProps) {
  const meshResult = useResource<ArrayMeshResource>(item?.meshPath ?? '', 'ArrayMesh');
  // The surface material path only becomes known once the ArrayMesh resolves.
  const materialPath = meshResult.value?.materialPaths[0] ?? '';
  const materialResult = useResource<THREE.Material>(materialPath, 'StandardMaterial3D');

  const matrices = useMemo(
    () => cells.map((cell) => cellMatrix(cell, cellSize, item?.meshTransform ?? null)),
    [cells, cellSize, item?.meshTransform]
  );

  const instanced = useMemo(() => {
    const geometry = meshResult.value?.geometry;
    if (!geometry) return null;
    const material =
      (materialPath && materialResult.value) ||
      new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, [meshResult.value, materialPath, materialResult.value, matrices]);

  if (instanced) {
    return <primitive object={instanced} />;
  }

  // Geometry not resolved yet (pending / missing item): show cell-sized
  // wireframe boxes so the grid structure is visible.
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
      <meshBasicMaterial color={0x4488cc} wireframe />
    </mesh>
  );
}
