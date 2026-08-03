/**
 * Decodes a Godot 4 text ArrayMesh (`.tres`, format=4) into per-surface typed
 * arrays for a THREE.BufferGeometry. Godot stores geometry as base64
 * `PackedByteArray` blobs laid out per the surface's uint64 `format`
 * bitfield — `surfaceFormat.ts` names that layout, `vertexBuffers.ts` reads it,
 * and `surfaceFields.ts` reads the surrounding dict fields. This file is the
 * surface loop and the material resolution around them.
 *
 * Scope: triangle primitive (non-triangle surfaces are skipped, see the loop).
 * Blend shapes / LODs / skins are ignored.
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
 * Resolve a surface's `"material"` to the resource path that addresses it.
 * Godot writes either form: an `ExtResource` when the surface points at a shared
 * material file, or a `SubResource` when the mesh carries its own — in which
 * case the material lives inside THIS file and is addressed by a **Sub-resource
 * path** (`selfPath::id`). Both come back as one path string, so nothing
 * downstream has to distinguish them.
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
 * The `_surfaces` value of the mesh this path addresses: the file's own
 * `[resource]` body, or a `[sub_resource type="ArrayMesh"]` inside it.
 *
 * An addressed sub-resource that is absent, or present but carrying no surfaces,
 * would otherwise decode to an empty mesh — a node rendering nothing with nothing
 * said about why. The material path fails loudly for the same class of error.
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
    // Godot writes `_surfaces` only for a mesh that HAS surfaces, so its absence
    // is ambiguous — and the answer is the resource's TYPE, not the address form.
    // An ArrayMesh without surfaces is a legitimately empty mesh and draws
    // nothing, exactly as Godot does. Anything else is not a mesh at all
    // (a BoxMesh `.tres`, a MeshLibrary) and must fail rather than cache an empty
    // geometry as a success, which renders an invisible node with no diagnostic.
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
  return decodeSurfaces(surfacesRaw, selfPath, (block) =>
    readMaterialPath(block, parsed, extById, filePath)
  );
}

/**
 * Decode an ArrayMesh declared as a `[sub_resource]` of a SCENE rather than of a
 * `.tres` — the third kind of reference, and the one no path can address: its
 * surface bytes are inline in the `.tscn`, so there is no file to fetch.
 *
 * Its `_surfaces` is the same dict format, so only the material lookup differs.
 * A surface's `ExtResource` material resolves against the SCENE's table; a
 * `SubResource` one names a material of the scene, which no resource PATH can
 * reach — so it comes back as an id for the renderer to resolve against the
 * scene's own resources, which it already holds.
 */
export function decodeSceneArrayMesh(
  resource: TscnInternalResource,
  externalResources: readonly TscnExternalResource[]
): ArrayMeshData {
  const surfacesRaw = resource.data['_surfaces'];
  // An ArrayMesh with no surfaces is legitimately empty and draws nothing.
  if (typeof surfacesRaw !== 'string') return { surfaces: [] };

  const extById = extResourcePathsById(externalResources);
  const mesh = decodeSurfaces(surfacesRaw, `SubResource("${resource.id}")`, (block) =>
    resolveRefToResourcePath(readMaterialRef(block), extById, '', REJECT_SUB_RESOURCES) ??
    undefined
  );
  // Carry the scene-local id alongside, since no path can express it.
  for (const [i, block] of [...iterateSurfaceBlocks(surfacesRaw)].entries()) {
    const surface = mesh.surfaces[i];
    if (!surface || surface.materialPath) continue;
    const ref = parseResourceReference(readMaterialRef(block) ?? '');
    if (ref?.type === 'SubResource') surface.materialSubResourceId = ref.id;
  }
  return mesh;
}

/**
 * First-wins id → path, matching `Array.find` over the same list.
 * `SceneResourcesContext` orders its resources own-scene-first precisely so a
 * duplicate id resolves to the nearer scene; a plain `new Map` is last-wins and
 * would silently hand back the PARENT's resource instead.
 */
function extResourcePathsById(
  resources: readonly TscnExternalResource[]
): ReadonlyMap<string, string> {
  const byId = new Map<string, string>();
  for (const r of resources) if (!byId.has(r.id)) byId.set(r.id, r.path);
  return byId;
}

/**
 * The shared surface loop. `label` names the mesh in diagnostics and errors;
 * `resolveMaterial` is the one thing that differs between a mesh read out of a
 * `.tres` and one inlined in a scene.
 */
function decodeSurfaces(
  surfacesRaw: string,
  label: string,
  resolveMaterial: (block: string) => string | undefined
): ArrayMeshData {
  const surfaces: ArrayMeshSurface[] = [];
  let declared = 0;
  let nonTriangle = 0;
  for (const [surfaceIndex, block] of [...iterateSurfaceBlocks(surfacesRaw)].entries()) {
    declared++;
    const format = readInt(block, 'format');
    const vertexCount = readInt(block, 'vertex_count');
    const indexCount = readInt(block, 'index_count');

    // A LINES/POINTS/STRIP surface indexes its vertices under different rules,
    // so reading it as triangles fabricates faces nobody authored. `readInt`
    // defaults an absent key to 0, but Godot always writes `primitive` for a
    // saved surface, so treat only a DECLARED non-triangle value as one.
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
      format,
      vertexCount,
      indexCount,
      positions,
      uvs,
      normals,
      indices,
      materialPath: resolveMaterial(block),
    });
  }

  // Dropping SOME surfaces keeps the mesh; dropping ALL of them means nothing
  // was readable, and that has to fail rather than cache an empty geometry as a
  // success — otherwise the node renders invisibly with no placeholder and the
  // user gets no signal at all.
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
