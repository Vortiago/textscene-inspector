/**
 * A CSGMesh3D's `mesh` as the triangle surfaces `Mesh::surface_get_arrays` gives Godot's brush
 * builder: Godot's winding and UV space, each surface with its own material. The mesh is an inline
 * ArrayMesh or PrimitiveMesh, or a `.tres` holding either.
 */

import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../../../godot/scene/primitiveMesh';
import { warn } from '../../../../logger';
import type { ParsedResource } from '../../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../../parser/types';
import type { CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import type { CsgMaterialAddress } from '../../../../r3f/csg/csgMaterials';
import type { SceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveSubResourceRef, parsedResourcePath } from '../../../../resources/SubResourceResolver';
import { decodeArrayMesh, decodeSceneArrayMesh } from '../../../../resources/meshes/arraymesh/decode';
import type { ArrayMeshData } from '../../../../resources/meshes/arraymesh/types';
import type { GodotSurface } from '../../../../resources/meshes/godotSurface';
import { scopedSection } from '../../../../resources/resourceSection';
import { meshKind, primitiveMaterialAddress, type MeshSource } from '../../../../resources/meshes/meshSource';
import { primitiveMeshSurface } from '../../../../resources/meshes/primitivemesh/surface';

/** The arrays of a Godot surface the brush builder reads, and the surface's material. */
export interface CsgMeshSurface extends Pick<GodotSurface, 'positions' | 'normals' | 'uvs' | 'indices'> {
  material: CsgMaterialAddress;
}

/**
 * A mesh, and for one in a file the parsed file, whose identity keys the brush and whose tables an
 * ArrayMesh's surfaces resolve their materials in.
 */
export type CsgMesh = MeshSource & { file: ParsedResource | null };

/** The `.tres` a mesh reference loads, or null for an inline mesh or a file no processor reads. */
export function meshFilePath(meshRef: string | undefined, pools: SceneResources): string | null {
  return parsedResourcePath(meshRef, pools.externalResources);
}

/** The mesh `meshRef` names, or null for none, an unknown id, or a file not loaded yet. */
export function resolveMesh(meshRef: string | undefined, ctx: CsgGeometryContext): CsgMesh | null {
  const inline = resolveSubResourceRef(meshRef, ctx.internalResources);
  if (inline) return { resource: inline, resources: ctx, path: null, file: null };
  const path = meshFilePath(meshRef, ctx);
  const file = path ? ctx.file(path) : undefined;
  const scoped = path && file ? scopedSection(file, path) : undefined;
  if (!path || !file || !scoped) return null;
  return { ...scoped, path, file };
}

/**
 * The mesh's triangle surfaces, or none for a type no slice builds. A mesh in the scene names its
 * materials by the scene's references, a mesh in a file by `res://` paths (ADR-0046).
 */
export function meshSurfaces(mesh: CsgMesh): CsgMeshSurface[] {
  const { resource, path, file } = mesh;
  switch (meshKind(resource.type)) {
    case 'primitive':
      return primitiveMeshSurfaces(resource, primitiveMaterialAddress(mesh));
    case 'arrayMesh':
      if (path && file) {
        const section = { file, type: resource.type, properties: resource.data };
        return arrayMeshSurfaces(
          () => decodeArrayMesh(section, path),
          path,
          (s) => s.materialPath
        );
      }
      return arrayMeshSurfaces(
        () => decodeSceneArrayMesh(resource),
        resource.id,
        (s) => s.materialRef
      );
    default:
      return [];
  }
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
 * answers it for surface 0), in Godot's arrays as the brush builder reads them.
 */
function primitiveMeshSurfaces(
  resource: TscnInternalResource,
  material: CsgMaterialAddress
): CsgMeshSurface[] {
  // The brush reads no UV2 (`csg_shape.cpp:1147-1172`), the only array the texel size scales.
  const surface = primitiveMeshSurface(resource, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
  if (!surface) return [];
  return [{ ...surface, material }];
}
