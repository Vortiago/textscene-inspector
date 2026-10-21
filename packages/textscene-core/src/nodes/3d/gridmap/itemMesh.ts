/**
 * The mesh a MeshLibrary item draws, from its **Sub-resource path** or file path: an ArrayMesh
 * through the ArrayMesh processor, or a PrimitiveMesh built as a MeshInstance3D builds one.
 * GridMap draws an item's mesh whatever kind it is (`modules/gridmap/grid_map.cpp:688-700`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ParsedResource } from '../../../parser/parsedResource';
import { useResource, type ResourceStatus } from '../../../resources/useResource';
import { useMissingReport } from '../../../r3f/contexts/MissingResourcesContext';
import { findSectionResource } from '../../../resources/resourceSection';
import { resourceFilePath } from '../../../resources/subResourcePath';
import { ARRAY_MESH_TYPES } from '../../../resources/meshes/arraymesh/decode';
import { isPrimitiveMeshType } from '../../../resources/meshes/primitivemesh/surface';
import { materialPathInFile } from '../../../resources/materials/materialPathInFile';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { fileMaterialSources, type MaterialSource } from '../../../r3f/materials/materialSource';
import { usePrimitiveMeshGeometry } from '../meshinstance3d/meshGeometry';

interface DrawnMesh {
  geometry: THREE.BufferGeometry;
  /** `materials[i]` is draw group `i`'s own material, undefined for Godot's default surface. */
  materials: (MaterialSource | undefined)[];
}

export type ItemMesh =
  | { status: 'pending' }
  /** No mesh, or one this previewer cannot read: GridMap draws its placeholder. */
  | { status: 'unavailable' }
  /** A mesh Godot builds no surface for, such as a TorusMesh of equal radii: it draws nothing. */
  | { status: 'empty' }
  | ({ status: 'loaded' } & DrawnMesh);

const PENDING: ItemMesh = { status: 'pending' };
const UNAVAILABLE: ItemMesh = { status: 'unavailable' };
const EMPTY: ItemMesh = { status: 'empty' };

export function useItemMesh(meshPath: string | null): ItemMesh {
  // `''` requests nothing.
  const filePath = meshPath ? resourceFilePath(meshPath) : '';
  const file = useResource<ParsedResource>(filePath, 'resource');
  const section = useMemo(
    () => (meshPath && file.value ? findSectionResource(file.value, meshPath) : undefined),
    [file.value, meshPath]
  );
  // The ArrayMesh processor is asked only once the section is one: a failed load is cached and
  // reported as a missing resource.
  const isArrayMesh = section !== undefined && ARRAY_MESH_TYPES.has(section.type);
  const arrayMesh = useResource<ArrayMeshResource>(isArrayMesh ? meshPath! : '', 'arraymesh');
  const primitive = section && isPrimitiveMeshType(section.type) ? section : null;
  useMissingReport(meshPath ?? '', sectionStatus(file.status, isArrayMesh || primitive !== null));
  const primitiveGeometry = usePrimitiveMeshGeometry(primitive);
  // Paths, as an ArrayMesh's materials are: one material inside the file has one identity (ADR-0046).
  const primitiveMaterials = useMemo(
    () =>
      primitive &&
      file.value &&
      fileMaterialSources([materialPathInFile(primitive.data['material'], file.value, filePath)]),
    [primitive, file.value, filePath]
  );
  const drawnArrayMesh = useMemo(
    (): DrawnMesh | null =>
      arrayMesh.value
        ? {
            geometry: arrayMesh.value.geometry,
            materials: fileMaterialSources(arrayMesh.value.materialPaths),
          }
        : null,
    [arrayMesh.value]
  );

  if (!meshPath) return UNAVAILABLE;
  if (file.status === 'pending') return PENDING;
  if (primitive) {
    if (!primitiveGeometry || !primitiveMaterials) return EMPTY;
    return { status: 'loaded', geometry: primitiveGeometry, materials: primitiveMaterials };
  }
  if (!isArrayMesh || arrayMesh.status === 'unavailable') return UNAVAILABLE;
  return drawnArrayMesh ? { status: 'loaded', ...drawnArrayMesh } : PENDING;
}

/**
 * A loaded file whose section no mesh slice builds fails the item's path, as the ArrayMesh
 * processor's type check does. Pending otherwise: the file's own report covers a failed load.
 */
function sectionStatus(fileStatus: ResourceStatus, isDrawable: boolean): ResourceStatus {
  if (fileStatus !== 'loaded') return 'pending';
  return isDrawable ? 'loaded' : 'unavailable';
}
