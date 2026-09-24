/**
 * Decodes a text ArrayMesh (`.tres`, format=4) into per-surface typed arrays:
 * the surface loop and its material resolution. Only triangle surfaces decode.
 * Blend shapes, LODs and skins are ignored. The byte layout lives in
 * `surfaceFormat.ts`, `vertexBuffers.ts` and `surfaceFields.ts`.
 */

import { warn } from '../../../logger.js';
import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource.js';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types.js';
import { BUILDABLE_MATERIAL_TYPES } from '../../materials/buildableMaterialTypes.js';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver.js';
import {
  parseSubResourcePath,
  REJECT_SUB_RESOURCES,
  resolveRefToResourcePath,
  subResourceTypeGate,
} from '../../subResourcePath.js';
import {
  iterateSurfaceBlocks,
  readAabb,
  readInt,
  readMaterialRef,
  readName,
  readPackedBytes,
  readUvScale,
} from './surfaceFields.js';
import { PRIMITIVE_TRIANGLES, surfaceLayout } from './surfaceFormat.js';
import type { ArrayMeshData, ArrayMeshSurface } from './types.js';
import { decodeIndices, decodeNormals, decodePositions, decodeUVs } from './vertexBuffers.js';

/**
 * Resolve a surface's `"material"` to one path string: an `ExtResource` to its
 * shared file, a `SubResource` to a **Sub-resource path** (`selfPath::id`) in
 * this file.
 */
function readMaterialPath(
  block: string,
  parsed: ParsedResource,
  extById: ReadonlyMap<string, string>,
  selfPath: string
): string | undefined {
  return (
    resolveRefToResourcePath(
      readMaterialRef(block),
      extById,
      selfPath,
      subResourceTypeGate(parsed.subResources, BUILDABLE_MATERIAL_TYPES)
    ) ?? undefined
  );
}

/**
 * The `_surfaces` of the mesh this path addresses: the file's `[resource]` body,
 * or a `[sub_resource type="ArrayMesh"]` inside it. An addressed sub-resource
 * that is absent or has no surfaces throws, rather than decode to an empty mesh
 * that renders nothing without a word.
 */
function readSurfacesRaw(
  parsed: ParsedResource,
  filePath: string,
  subResourceId: string | undefined
): string | undefined {
  if (subResourceId === undefined) return parsed.properties['_surfaces'];

  const sub = findSubResource(parsed.subResources, subResourceId);
  if (!sub) {
    warn(
      `[ArrayMesh] ${filePath} declares no sub-resource "${subResourceId}" — ` +
        `the mesh addressing it renders nothing`
    );
    return undefined;
  }
  const raw = sub.data['_surfaces'];
  if (typeof raw !== 'string') {
    warn(
      `[ArrayMesh] sub-resource "${subResourceId}" in ${filePath} is a ${sub.type} ` +
        `and carries no surfaces — the mesh addressing it renders nothing`
    );
    return undefined;
  }
  return raw;
}

/**
 * @param selfPath - the resource path this mesh was requested under. A material
 *   declared as a `[sub_resource]` here can only be addressed relative to its
 *   own file, so this is an input, not a convenience. May itself be a
 *   **Sub-resource path**, which selects a `[sub_resource type="ArrayMesh"]`
 *   inside the file (a `shadow_mesh`, or a MeshLibrary's embedded item mesh)
 *   rather than the file's own `[resource]` body.
 */
export function decodeArrayMesh(content: string, selfPath: string): ArrayMeshData {
  const parsed = parseTresFile(content);
  const { filePath, subResourceId } = parseSubResourcePath(selfPath);
  const surfacesRaw = readSurfacesRaw(parsed, filePath, subResourceId);
  if (!surfacesRaw) {
    // Godot writes `_surfaces` only for a mesh that has surfaces, so the type
    // decides: an ArrayMesh without it is legitimately empty, as in Godot. Any
    // other type (a BoxMesh `.tres`, a MeshLibrary) fails, rather than cache an
    // empty geometry that renders an invisible node with no diagnostic.
    const addressed =
      subResourceId === undefined
        ? parsed.resourceType
        : findSubResource(parsed.subResources, subResourceId)?.type;
    if (addressed !== 'ArrayMesh') {
      throw new Error(
        `${selfPath} is a ${addressed ?? 'missing resource'}, not an ArrayMesh`
      );
    }
    return { surfaces: [] };
  }

  const extById = extResourcePathsById(parsed.extResources);
  return decodeSurfaces(surfacesRaw, selfPath, (block) => ({
    materialPath: readMaterialPath(block, parsed, extById, filePath),
  }));
}

/**
 * Decode an ArrayMesh that is a `[sub_resource]` of a scene: its bytes are inline
 * in the `.tscn`, so no path addresses it. An `ExtResource` material resolves
 * against the scene's table. A `SubResource` one comes back as an id for the
 * renderer to resolve against the scene's own resources.
 */
export function decodeSceneArrayMesh(
  resource: TscnInternalResource,
  externalResources: readonly TscnExternalResource[]
): ArrayMeshData {
  const surfacesRaw = resource.data['_surfaces'];
  // An ArrayMesh with no surfaces is legitimately empty and draws nothing.
  if (typeof surfacesRaw !== 'string') return { surfaces: [] };

  const extById = extResourcePathsById(externalResources);
  // Both halves per block, inside the one walk. `decodeSurfaces` skips a
  // non-triangle or undecodable surface, so surface `i` is not block `i`, and
  // pairing them by position gives a material to the wrong surface.
  return decodeSurfaces(surfacesRaw, `SubResource("${resource.id}")`, (block) => {
    const raw = readMaterialRef(block);
    const materialPath =
      resolveRefToResourcePath(raw, extById, '', REJECT_SUB_RESOURCES) ?? undefined;
    if (materialPath !== undefined) return { materialPath };
    // The scene-local id, since no path can express it.
    const ref = parseResourceReference(raw ?? '');
    return ref?.type === 'SubResource' ? { materialSubResourceId: ref.id } : {};
  });
}

/**
 * First-wins id → path, matching `Array.find` over the same list.
 * `SceneResourcesContext` orders its resources own-scene-first so a duplicate id
 * resolves to the nearer scene. A plain `new Map` is last-wins and would hand
 * back the parent's resource.
 */
function extResourcePathsById(
  resources: readonly TscnExternalResource[]
): ReadonlyMap<string, string> {
  const byId = new Map<string, string>();
  for (const r of resources) if (!byId.has(r.id)) byId.set(r.id, r.path);
  return byId;
}

/**
 * The shared surface loop. `label` names the mesh in diagnostics and errors.
 * `resolveMaterial` is the one thing that differs between a mesh read out of a
 * `.tres` and one inlined in a scene.
 */
function decodeSurfaces(
  surfacesRaw: string,
  label: string,
  resolveMaterial: (block: string) => Pick<ArrayMeshSurface, 'materialPath' | 'materialSubResourceId'>
): ArrayMeshData {
  const surfaces: ArrayMeshSurface[] = [];
  let declared = 0;
  let nonTriangle = 0;
  for (const [surfaceIndex, block] of [...iterateSurfaceBlocks(surfacesRaw)].entries()) {
    declared++;
    const format = readInt(block, 'format');
    const vertexCount = readInt(block, 'vertex_count');
    const indexCount = readInt(block, 'index_count');

    // A LINES/POINTS/STRIP surface read as triangles fabricates faces. `readInt`
    // defaults an absent key to 0, and Godot always writes `primitive` for a
    // saved surface, so only a declared non-triangle value skips it.
    const primitive = block.includes('"primitive"')
      ? readInt(block, 'primitive')
      : PRIMITIVE_TRIANGLES;
    if (primitive !== PRIMITIVE_TRIANGLES) {
      nonTriangle++;
      const name = readName(block);
      warn(
        `[ArrayMesh] surface ${surfaceIndex}${name ? ` "${name}"` : ''} is primitive ` +
          `${primitive}, not triangles (3) — skipping it; this decoder builds triangle ` +
          `geometry only`
      );
      continue;
    }

    const layout = surfaceLayout(format);
    const vertexData = readPackedBytes(block, 'vertex_data');
    // Positions: a contiguous region at the front of vertex_data.
    const positions = decodePositions(vertexData, vertexCount, layout, readAabb(block));
    if (!positions) {
      const name = readName(block);
      warn(
        `[ArrayMesh] surface ${surfaceIndex}${name ? ` "${name}"` : ''} has no decodable ` +
          `positions (format ${format}, ${vertexCount} verts, ${vertexData.byteLength} B ` +
          `vertex_data) — dropping the surface so the rest of the mesh still renders`
      );
      continue;
    }
    // Normals: octahedral pairs in the region following the positions.
    const normals = decodeNormals(vertexData, vertexCount, layout);
    const uvs = decodeUVs(
      readPackedBytes(block, 'attribute_data'),
      vertexCount,
      layout,
      readUvScale(block),
      (actualStride) =>
        warn(
          `[ArrayMesh] surface ${surfaceIndex}'s attribute_data is ${actualStride} B/vertex, ` +
            `not the ${layout.attributeStride} B format ${format} implies — dropping its UVs`
        )
    );
    const indexData = readPackedBytes(block, 'index_data');
    const indices = decodeIndices(indexData, indexCount);
    if (!indices) {
      warn(
        `[ArrayMesh] surface ${surfaceIndex}'s index_data is ${indexData.byteLength} B for ` +
          `${indexCount} indices — dropping the surface so the rest of the mesh still renders`
      );
      continue;
    }

    surfaces.push({
      surfaceIndex,
      format,
      vertexCount,
      indexCount,
      positions,
      uvs,
      normals,
      indices,
      ...resolveMaterial(block),
    });
  }

  // Dropping some surfaces keeps the mesh. Dropping all of them fails, rather
  // than cache an empty geometry that renders invisibly with no placeholder.
  if (declared > 0 && surfaces.length === 0) {
    // Naming the non-triangle count keeps a LINES-only mesh from reading as a
    // byte defect: nothing was corrupt, the geometry just is not triangles.
    const reason = nonTriangle > 0 ? ` (${nonTriangle} skipped as non-triangle)` : '';
    throw new Error(
      `ArrayMesh ${label}: none of its ${declared} surface(s) could be decoded${reason}`
    );
  }
  return { surfaces };
}
