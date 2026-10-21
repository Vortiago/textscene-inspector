/**
 * A mesh resource and where it lives, the one shape MeshInstance3D, GridMap and CSGMesh3D read a
 * mesh in. Which kind of mesh it is, and where its own material lives, follow from it.
 */

import type { TscnInternalResource } from '../../parser/types.js';
import type { SceneResources } from '../../r3f/SceneResourcesContext.js';
import { materialPathInFile } from '../materials/materialPathInFile.js';
import { resourceFilePath } from '../subResourcePath.js';
import { ARRAY_MESH_TYPES } from './arraymesh/decode.js';
import { PRIMITIVE_MESH_TYPES } from './primitivemesh/surface.js';

export interface MeshSource {
  resource: TscnInternalResource;
  /** The tables the mesh's own references resolve in. */
  resources: SceneResources;
  /** The path the mesh loads from, a file or a **Sub-resource path**. Null for a mesh in the scene. */
  path: string | null;
}

/** The mesh types a slice here builds. Godot draws any `Ref<Mesh>`, and another type has no builder. */
export const MESH_TYPES: ReadonlySet<string> = new Set([...ARRAY_MESH_TYPES, ...PRIMITIVE_MESH_TYPES]);

type MeshKind = 'arrayMesh' | 'primitive';

/** Which builder draws a mesh of `type`, or null for a type no slice builds. */
export function meshKind(type: string): MeshKind | null {
  if (ARRAY_MESH_TYPES.has(type)) return 'arrayMesh';
  return PRIMITIVE_MESH_TYPES.has(type) ? 'primitive' : null;
}

/**
 * A PrimitiveMesh's one surface material, its own `material` as `surface_get_material` answers it
 * (`primitive_meshes.cpp:204`). A mesh in a file names it by path, as an ArrayMesh's surfaces do,
 * so one material has one identity (ADR-0046). A mesh in the scene keeps the scene's reference.
 */
export function primitiveMaterialAddress({ resource, resources, path }: MeshSource): string | undefined {
  const ref = resource.data['material'];
  if (!path) return ref;
  const tables = { extResources: resources.externalResources, subResources: resources.internalResources };
  return materialPathInFile(ref, tables, resourceFilePath(path)) ?? undefined;
}
