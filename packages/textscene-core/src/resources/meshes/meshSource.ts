/**
 * A mesh resource and where it lives, the one shape MeshInstance3D, GridMap and CSGMesh3D read a
 * mesh in. Which kind of mesh it is, and where its own material lives, follow from it.
 */

import { materialPathInFile } from '../materials/materialPathInFile.js';
import type { ResolvableResource, ScopedResource } from '../scopedResource.js';
import { resourceFilePath } from '../subResourcePath.js';
import { ARRAY_MESH_TYPES } from './arraymesh/decode.js';
import { resourceContentKey } from '../resourceContentKey.js';
import { isDrawablePrimitiveMesh, isPrimitiveMeshType, referencesKey } from './primitivemesh/surface.js';

export interface MeshSource extends ResolvableResource {
  /** The path the mesh loads from, a file or a **Sub-resource path**. Null for a mesh in the scene. */
  path: string | null;
}

type MeshKind = 'arrayMesh' | 'primitive' | 'surfaceless';

/**
 * Meshes Godot loads with no surface to draw: a PlaceholderMesh has none (`mesh.h:421`), and an
 * ImmediateMesh saves none, since only a script fills it (`immediate_mesh.cpp:405-417`).
 */
const SURFACELESS_MESH_TYPES: ReadonlySet<string> = new Set(['ImmediateMesh', 'PlaceholderMesh']);

/** How a mesh of `type` draws: through which builder, or with no surface. Null for a type no slice builds. */
export function meshKind(type: string): MeshKind | null {
  if (ARRAY_MESH_TYPES.has(type)) return 'arrayMesh';
  if (SURFACELESS_MESH_TYPES.has(type)) return 'surfaceless';
  return isPrimitiveMeshType(type) ? 'primitive' : null;
}

/**
 * Whether this previewer draws `mesh`. A type no slice builds is not drawn, and neither is a
 * TextMesh whose font it cannot read. A mesh with no surface is drawn, and empty.
 */
export function isDrawableMesh(mesh: ResolvableResource): boolean {
  const kind = meshKind(mesh.resource.type);
  return kind === 'primitive' ? isDrawablePrimitiveMesh(mesh) : kind !== null;
}

/**
 * A key over everything `mesh` builds from, for memoising what is built from it: a fresh parse of
 * equal content gives an equal key. A PrimitiveMesh follows the resources its builder reads.
 */
export function meshContentKey(mesh: ResolvableResource): string {
  const references = referencesKey(mesh);
  const own = resourceContentKey(mesh.resource);
  return references ? `${own}|${references}` : own;
}

/**
 * A PrimitiveMesh's one surface material, its own `material` as `surface_get_material` answers it
 * (`primitive_meshes.cpp:204`). A mesh in a file names it by path, as an ArrayMesh's surfaces do,
 * so one material has one identity (ADR-0046). A mesh in the scene keeps the scene's reference.
 */
export function primitiveMaterialAddress(
  { resource, resources }: ScopedResource,
  path: string | null
): string | undefined {
  const ref = resource.data['material'];
  if (!path) return ref;
  return materialPathInFile(ref, resources, resourceFilePath(path)) ?? undefined;
}
