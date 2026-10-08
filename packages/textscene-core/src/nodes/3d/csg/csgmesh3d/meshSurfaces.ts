/**
 * A CSGMesh3D's `mesh` as the triangle surfaces `Mesh::surface_get_arrays` gives Godot's brush
 * builder: Godot's winding and UV space, each surface with its own material. The mesh is an inline
 * ArrayMesh or PrimitiveMesh, or a `.tres` holding either.
 */

import type * as THREE from 'three';
import { warn } from '../../../../logger';
import type { ParsedResource } from '../../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../../parser/types';
import type { CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import type { CsgMaterialAddress } from '../../../../r3f/csg/csgMaterials';
import {
  findSubResource,
  parseResourceReference,
  resolveExtResourcePath,
} from '../../../../resources/SubResourceResolver';
import { decodeArrayMesh, decodeSceneArrayMesh } from '../../../../resources/meshes/arraymesh/decode';
import type { ArrayMeshData } from '../../../../resources/meshes/arraymesh/types';
import { BUILDABLE_MATERIAL_TYPES } from '../../../../resources/materials/buildableMaterialTypes';
import {
  extResourcePathsById,
  resolveRefToResourcePath,
  subResourceTypeGate,
} from '../../../../resources/subResourcePath';
import { buildPrimitiveMeshGeometry } from '../../meshinstance3d/primitiveMeshGeometry';

export interface CsgMeshSurface {
  /** `xyz` per vertex. */
  positions: Float32Array;
  /** `xyz` per vertex, or undefined for a surface with no ARRAY_NORMAL. */
  normals?: Float32Array;
  /** `uv` per vertex with V down, or undefined for a surface with no ARRAY_TEX_UV. */
  uvs?: Float32Array;
  /** Three per triangle, front faces clockwise. */
  indices: ArrayLike<number>;
  material: CsgMaterialAddress;
}

/** The `.tres` a mesh reference loads, or null for an inline mesh or a file no processor reads. */
export function meshFilePath(
  meshRef: string | undefined,
  ctx: Pick<CsgGeometryContext, 'externalResources'>
): string | null {
  if (parseResourceReference(meshRef ?? '')?.type !== 'ExtResource') return null;
  const path = resolveExtResourcePath(meshRef, ctx.externalResources);
  return path?.endsWith('.tres') ? path : null;
}

/** The surfaces `meshRef` names, or none while its file loads, or for a mesh with no slice here. */
export function meshSurfaces(meshRef: string | undefined, ctx: CsgGeometryContext): CsgMeshSurface[] {
  const ref = parseResourceReference(meshRef ?? '');
  if (ref?.type === 'SubResource') {
    const resource = findSubResource(ctx.internalResources, ref.id);
    return resource ? sceneMeshSurfaces(resource) : [];
  }
  const path = meshFilePath(meshRef, ctx);
  const file = path ? ctx.file(path) : undefined;
  return path && file ? fileMeshSurfaces(file, path) : [];
}

/** A mesh in the scene: its materials are references in the scene's tables. */
function sceneMeshSurfaces(resource: TscnInternalResource): CsgMeshSurface[] {
  if (resource.type === 'ArrayMesh') {
    return arrayMeshSurfaces(
      () => decodeSceneArrayMesh(resource),
      resource.id,
      (s) => s.materialRef
    );
  }
  return primitiveMeshSurfaces(resource, resource.data['material']);
}

/** A mesh `.tres`: its materials are `res://` paths, as its own references resolve in its own file. */
function fileMeshSurfaces(file: ParsedResource, path: string): CsgMeshSurface[] {
  if (file.resourceType === 'ArrayMesh') {
    const section = { file, type: file.resourceType, properties: file.properties };
    return arrayMeshSurfaces(
      () => decodeArrayMesh(section, path),
      path,
      (s) => s.materialPath
    );
  }
  const material = resolveRefToResourcePath(
    file.properties['material'],
    extResourcePathsById(file.extResources),
    path,
    subResourceTypeGate(file.subResources, BUILDABLE_MATERIAL_TYPES)
  );
  return primitiveMeshSurfaces(
    { id: path, type: file.resourceType, data: file.properties },
    material ?? undefined
  );
}

/**
 * An ArrayMesh's decoded surfaces. A mesh none of whose surfaces decodes contributes nothing, as
 * Godot's brush skips a surface with no vertices (`csg_shape.cpp:1149-1151`).
 */
function arrayMeshSurfaces(
  decode: () => ArrayMeshData,
  label: string,
  materialOf: (surface: ArrayMeshData['surfaces'][number]) => CsgMaterialAddress
): CsgMeshSurface[] {
  let mesh: ArrayMeshData;
  try {
    mesh = decode();
  } catch (error) {
    warn(`[CSGMesh3D] ${label} builds no brush: ${String(error)}`);
    return [];
  }
  return mesh.surfaces.map((surface) => ({
    positions: surface.positions,
    normals: surface.normals,
    uvs: surface.uvs,
    indices: surface.indices,
    material: materialOf(surface),
  }));
}

/**
 * A PrimitiveMesh's one surface under its `material` (`primitive_meshes.cpp`, `surface_get_material`
 * answers it for surface 0). The slice builds it in three's space, so this turns it back.
 */
function primitiveMeshSurfaces(
  resource: TscnInternalResource,
  material: CsgMaterialAddress
): CsgMeshSurface[] {
  const geometry = buildPrimitiveMeshGeometry(resource);
  if (!geometry) return [];
  const surface = godotSurface(geometry, material);
  geometry.dispose();
  return [surface];
}

/** three fronts triangles counter-clockwise with V up, where Godot fronts them clockwise with V down. */
function godotSurface(geometry: THREE.BufferGeometry, material: CsgMaterialAddress): CsgMeshSurface {
  const positions = Float32Array.from(geometry.getAttribute('position').array);
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const uvs = uv ? Float32Array.from(uv.array) : undefined;
  if (uvs) for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - uvs[i]!;
  const vertexCount = positions.length / 3;
  const index = geometry.getIndex();
  const indices = Uint32Array.from(index ? index.array : { length: vertexCount }, (v, i) => (index ? v : i));
  for (let i = 0; i + 2 < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
  return { positions, normals: normal ? Float32Array.from(normal.array) : undefined, uvs, indices, material };
}
