/**
 * The mesh a MeshLibrary item draws, from its **Sub-resource path** or file path: an ArrayMesh
 * through the ArrayMesh processor, or a PrimitiveMesh built as a MeshInstance3D builds one.
 * GridMap draws an item's mesh whatever kind it is (`modules/gridmap/grid_map.cpp:688-700`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { useResource } from '../../../resources/useResource';
import { findResourceSection } from '../../../resources/resourceSection';
import { resourceFilePath } from '../../../resources/subResourcePath';
import { ARRAY_MESH_TYPES } from '../../../resources/meshes/arraymesh/decode';
import { isPrimitiveMeshType } from '../../../resources/meshes/primitivemesh/surface';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import {
  fileMaterialSources,
  resolveMaterialSource,
  type MaterialSource,
} from '../../../r3f/materials/materialSource';
import { usePrimitiveMeshGeometry } from '../meshinstance3d/meshGeometry';

export type ItemMesh =
  | { status: 'pending' }
  /** No mesh, or one this previewer cannot read: GridMap draws its placeholder. */
  | { status: 'unavailable' }
  /** A null geometry is a mesh Godot builds no surface for, which draws nothing. */
  | { status: 'loaded'; geometry: THREE.BufferGeometry | null; materials: (MaterialSource | undefined)[] };

const PENDING: ItemMesh = { status: 'pending' };
const UNAVAILABLE: ItemMesh = { status: 'unavailable' };

export function useItemMesh(meshPath: string | null): ItemMesh {
  // `''` requests nothing.
  const file = useResource<ParsedResource>(meshPath ? resourceFilePath(meshPath) : '', 'resource');
  const section = useMemo(
    () => (meshPath && file.value ? meshSection(file.value, meshPath) : null),
    [file.value, meshPath]
  );
  // The ArrayMesh processor is asked only once the section is one: a failed load is cached and
  // reported as a missing resource.
  const isArrayMesh = section !== null && ARRAY_MESH_TYPES.has(section.resource.type);
  const arrayMesh = useResource<ArrayMeshResource>(isArrayMesh ? meshPath! : '', 'arraymesh');
  const primitive = section && isPrimitiveMeshType(section.resource.type) ? section : null;
  const primitiveGeometry = usePrimitiveMeshGeometry(primitive?.resource ?? null);
  const primitiveMaterials = useMemo(() => primitive && [primitiveMaterial(primitive)], [primitive]);
  const arrayMeshMaterials = useMemo(
    () => arrayMesh.value && fileMaterialSources(arrayMesh.value.materialPaths),
    [arrayMesh.value]
  );

  if (!meshPath) return UNAVAILABLE;
  if (file.status === 'pending') return PENDING;
  if (primitiveMaterials)
    return { status: 'loaded', geometry: primitiveGeometry, materials: primitiveMaterials };
  if (!isArrayMesh || arrayMesh.status === 'unavailable') return UNAVAILABLE;
  if (!arrayMesh.value || !arrayMeshMaterials) return PENDING;
  return { status: 'loaded', geometry: arrayMesh.value.geometry, materials: arrayMeshMaterials };
}

/** A mesh section and the tables of the file that holds it, which its own references resolve in. */
interface MeshSection {
  resource: TscnInternalResource;
  file: ParsedResource;
}

/** The section `meshPath` addresses in `file`, or null for an id `file` does not declare. */
function meshSection(file: ParsedResource, meshPath: string): MeshSection | null {
  const section = findResourceSection(file, meshPath);
  if (!section) return null;
  return { resource: { id: meshPath, type: section.type, data: section.properties }, file };
}

/**
 * A PrimitiveMesh's one surface material, its own `material` as `surface_get_material` answers
 * it (`primitive_meshes.cpp:204`), resolved in the file that holds the mesh.
 */
function primitiveMaterial({ resource, file }: MeshSection): MaterialSource | undefined {
  return resolveMaterialSource(resource.data['material'], {
    internalResources: file.subResources,
    externalResources: file.extResources,
  });
}
