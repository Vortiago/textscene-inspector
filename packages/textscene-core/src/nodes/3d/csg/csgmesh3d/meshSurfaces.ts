/**
 * A CSGMesh3D's `mesh` as the triangle surfaces `Mesh::surface_get_arrays` gives Godot's brush
 * builder: Godot's winding and UV space, each surface with its own material. The mesh is an inline
 * ArrayMesh or PrimitiveMesh, or a `.tres` holding either.
 */

import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../../../godot/scene/primitiveMesh';
import { warn } from '../../../../logger';
import type { ParsedResource } from '../../../../parser/parsedResource';
import type { CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import type { CsgMaterialAddress } from '../../../../r3f/csg/csgMaterials';
import { decodeArrayMesh, decodeSceneArrayMesh } from '../../../../resources/meshes/arraymesh/decode';
import type { ArrayMeshData } from '../../../../resources/meshes/arraymesh/types';
import type { GodotSurface } from '../../../../resources/meshes/godotSurface';
import { referencedFilePath, resolveReference } from '../../../../resources/resolveReference';
import type { ResolvableResource } from '../../../../resources/scopedResource';
import { meshKind, primitiveMaterialAddress } from '../../../../resources/meshes/meshSource';
import { primitiveMeshSurface } from '../../../../resources/meshes/primitivemesh/surface';

/** The arrays of a Godot surface the brush builder reads, and the surface's material. */
export interface CsgMeshSurface extends Pick<GodotSurface, 'positions' | 'normals' | 'uvs' | 'indices'> {
  material: CsgMaterialAddress;
}

/** A mesh, and for one in a file where it loads from, whose parse keys the brush. */
export interface CsgMesh extends ResolvableResource {
  /** Null for a mesh in the scene. */
  file: { path: string; parsed: ParsedResource } | null;
}

/**
 * Written only by `resolveMesh`: the meshes of each context by reference. A context holds its
 * tables and files for good, so a reference names the same mesh for as long as the context lives.
 */
const meshesByContext = new WeakMap<CsgGeometryContext, Map<string, CsgMesh | null>>();

/**
 * The mesh `meshRef` names, or null for none, an unknown id, or a file not loaded yet. The same
 * object for the same reference in a context, so the geometry and its key share one read.
 */
export function resolveMesh(meshRef: string | undefined, ctx: CsgGeometryContext): CsgMesh | null {
  if (!meshRef) return null;
  let meshes = meshesByContext.get(ctx);
  if (!meshes) meshesByContext.set(ctx, (meshes = new Map()));
  const cached = meshes.get(meshRef);
  if (cached !== undefined) return cached;
  const mesh = readMesh(meshRef, ctx);
  meshes.set(meshRef, mesh);
  return mesh;
}

function readMesh(meshRef: string, ctx: CsgGeometryContext): CsgMesh | null {
  const scoped = resolveReference(meshRef, ctx, ctx.loadedFile);
  if (!scoped) return null;
  const path = referencedFilePath(meshRef, ctx);
  const parsed = path ? ctx.loadedFile(path) : undefined;
  return { ...scoped, loadedFile: ctx.loadedFile, file: path && parsed ? { path, parsed } : null };
}

/**
 * The mesh's triangle surfaces, or none for a mesh with no surface or a type no slice builds. A mesh
 * in the scene names its materials by the scene's references, a mesh in a file by `res://` paths
 * (ADR-0046).
 */
export function meshSurfaces(mesh: CsgMesh): CsgMeshSurface[] {
  const { resource, file } = mesh;
  switch (meshKind(resource.type)) {
    case 'primitive':
      return primitiveMeshSurfaces(mesh, primitiveMaterialAddress(mesh, file?.path ?? null));
    case 'arrayMesh':
      if (file) {
        const section = { file: file.parsed, type: resource.type, properties: resource.data };
        return arrayMeshSurfaces(
          () => decodeArrayMesh(section, file.path),
          file.path,
          (s) => s.materialPath
        );
      }
      return arrayMeshSurfaces(
        () => decodeSceneArrayMesh(resource),
        resource.id,
        (s) => s.materialRef
      );
    case 'surfaceless':
    case null:
      return [];
  }
}

/**
 * An ArrayMesh's decoded triangle surfaces. A mesh none of whose surfaces decodes contributes
 * nothing, as Godot's brush skips a surface with no vertices (`csg_shape.cpp:1149-1151`).
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
  // A points surface adds nothing: the brush builder skips every surface that is not triangles.
  return mesh.surfaces
    .filter((surface) => !surface.isPoints)
    .map((surface) => ({
      positions: surface.positions,
      normals: surface.normals,
      uvs: surface.uvs,
      indices: surface.indices,
      material: materialOf(surface),
    }));
}

/**
 * A PrimitiveMesh's one surface under its `material` (`primitive_meshes.cpp`, `surface_get_material`
 * answers it for surface 0), in Godot's arrays as the brush builder reads them. A points surface
 * adds nothing: the brush builder skips every surface that is not triangles (`csg_shape.cpp:1148-1150`).
 */
function primitiveMeshSurfaces(mesh: ResolvableResource, material: CsgMaterialAddress): CsgMeshSurface[] {
  // The brush reads no UV2 (`csg_shape.cpp:1147-1172`), the only array the texel size scales.
  const surface = primitiveMeshSurface(mesh, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
  if (!surface || surface.isPoints) return [];
  return [{ ...surface, material }];
}
