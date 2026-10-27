/**
 * Decodes an ArrayMesh's `_surfaces`, from a `.tres` or a binary file, into per-surface typed arrays:
 * the surface loop and its material resolution. Only triangle and points surfaces decode, and a
 * mesh with both keeps its triangles. Blend shapes, LODs and skins are ignored. The byte layout lives in
 * `surfaceFormat.ts`, `surfaceVersion.ts`, `vertexBuffers.ts` and `surfaceFields.ts`.
 */

import { warn } from '../../../logger.js';
import type { TscnInternalResource } from '../../../parser/types.js';
import { materialPathInFile } from '../../materials/materialPathInFile.js';
import { fileResources, type LoadedSection } from '../../resourceSection.js';
import { resourceFilePath } from '../../subResourcePath.js';
import {
  iterateSurfaceBlocks,
  readAabb,
  readInt,
  readMaterialRef,
  readName,
  readPackedBytes,
  readUvScale,
} from './surfaceFields.js';
import {
  PRIMITIVE_POINTS,
  PRIMITIVE_TRIANGLES,
  PRIMITIVE_TRIANGLE_STRIP,
  surfaceLayout,
} from './surfaceFormat.js';
import { currentVertexData } from './surfaceVersion.js';
import type { ArrayMeshData, ArrayMeshSurface } from './types.js';
import { decodeIndices, decodeNormalFrame, decodePositions, decodeUVs } from './vertexBuffers.js';

/** The type names this slice claims: Godot's ArrayMesh class alone, whose `_surfaces` this decodes. */
export const ARRAY_MESH_TYPES: ReadonlySet<string> = new Set(['ArrayMesh']);

/**
 * Decode the ArrayMesh **Resource section** `selfPath` addresses. Godot writes
 * `_surfaces` only for a mesh that has surfaces, so a section without it is
 * legitimately empty, as in Godot.
 * @param section - the section, with the file whose tables resolve its materials.
 * @param selfPath - the resource path this mesh was requested under. A material
 *   declared as a `[sub_resource]` here can only be addressed relative to its
 *   own file, so this is an input, not a convenience.
 */
export function decodeArrayMesh({ file, properties }: LoadedSection, selfPath: string): ArrayMeshData {
  const surfacesRaw = properties['_surfaces'];
  if (!surfacesRaw) return { surfaces: [] };

  const filePath = resourceFilePath(selfPath);
  const resources = fileResources(file);
  return decodeSurfaces(surfacesRaw, selfPath, (block) => ({
    materialPath: materialPathInFile(readMaterialRef(block), resources, filePath) ?? undefined,
  }));
}

/**
 * Decode an ArrayMesh that is a `[sub_resource]` of a scene: its bytes are inline
 * in the `.tscn`, so no path addresses it. Each surface keeps its raw material
 * reference for the renderer to resolve against the scene's resources, which can
 * change while the bytes stay the same.
 */
export function decodeSceneArrayMesh(resource: TscnInternalResource): ArrayMeshData {
  const surfacesRaw = resource.data['_surfaces'];
  // An ArrayMesh with no surfaces is legitimately empty and draws nothing.
  if (typeof surfacesRaw !== 'string') return { surfaces: [] };

  // Inside the one walk: `decodeSurfaces` skips a non-triangle or undecodable
  // surface, so surface `i` is not block `i`, and pairing them by position gives
  // a material to the wrong surface.
  return decodeSurfaces(surfacesRaw, `SubResource("${resource.id}")`, (block) => ({
    materialRef: readMaterialRef(block),
  }));
}

/**
 * A surface Godot saved with no `index_data` draws its vertices in order, three to a triangle or one
 * to a point, as `add_surface_from_arrays` with no ARRAY_INDEX does.
 */
function drawOrderIndices(vertexCount: number): Uint32Array {
  const indices = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) indices[i] = i;
  return indices;
}

/**
 * A triangle strip as a triangle list, as `Mesh::generate_triangle_mesh` reads it (`mesh.cpp:352-366`):
 * slot `j` makes the triangle `(j-2, j-1, j)`, and an odd `j` swaps the last two so each keeps one
 * winding. Fewer than three indices make no triangle.
 */
function stripToTriangles(strip: Uint32Array): Uint32Array {
  const triangleCount = Math.max(strip.length - 2, 0);
  const triangles = new Uint32Array(triangleCount * 3);
  for (let j = 2; j < strip.length; j++) {
    const odd = j % 2 === 1;
    const out = (j - 2) * 3;
    triangles[out] = strip[j - 2]!;
    triangles[out + 1] = strip[odd ? j : j - 1]!;
    triangles[out + 2] = strip[odd ? j - 1 : j]!;
  }
  return triangles;
}

/**
 * The shared surface loop. `label` names the mesh in diagnostics and errors.
 * `readMaterial` is the one thing that differs between a mesh read out of a
 * `.tres` and one inlined in a scene.
 */
function decodeSurfaces(
  surfacesRaw: string,
  label: string,
  readMaterial: (block: string) => Pick<ArrayMeshSurface, 'materialPath' | 'materialRef'>
): ArrayMeshData {
  const surfaces: ArrayMeshSurface[] = [];
  let declared = 0;
  let nonTriangle = 0;
  for (const [surfaceIndex, block] of [...iterateSurfaceBlocks(surfacesRaw)].entries()) {
    declared++;
    const format = readInt(block, 'format');
    const vertexCount = readInt(block, 'vertex_count');
    const indexCount = readInt(block, 'index_count');

    // A LINES or LINE_STRIP surface read as triangles fabricates faces. `readInt` defaults an
    // absent key to 0, and Godot always writes `primitive` for a saved surface, so only a declared
    // value other than triangles, a triangle strip or points skips it.
    const primitive = block.includes('"primitive"') ? readInt(block, 'primitive') : PRIMITIVE_TRIANGLES;
    const isPoints = primitive === PRIMITIVE_POINTS;
    const isStrip = primitive === PRIMITIVE_TRIANGLE_STRIP;
    if (primitive !== PRIMITIVE_TRIANGLES && !isPoints && !isStrip) {
      nonTriangle++;
      const name = readName(block);
      warn(
        `[ArrayMesh] surface ${surfaceIndex}${name ? ` "${name}"` : ''} is primitive ` +
          `${primitive}, not triangles (3), a triangle strip (4) or points (0) — skipping it; this ` +
          `decoder builds triangle and points geometry only`
      );
      continue;
    }

    const layout = surfaceLayout(format);
    const vertexData = currentVertexData(format, readPackedBytes(block, 'vertex_data'), vertexCount);
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
    const { normals, tangents } = decodeNormalFrame(vertexData, vertexCount, layout);
    const { uvs, uv2s } = decodeUVs(
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
    const stored = indexCount === 0 ? drawOrderIndices(vertexCount) : decodeIndices(indexData, indexCount);
    if (!stored) {
      warn(
        `[ArrayMesh] surface ${surfaceIndex}'s index_data is ${indexData.byteLength} B for ` +
          `${indexCount} indices — dropping the surface so the rest of the mesh still renders`
      );
      continue;
    }
    const indices = isStrip ? stripToTriangles(stored) : stored;

    surfaces.push({
      surfaceIndex,
      format,
      vertexCount,
      indexCount: indices.length,
      positions,
      uvs,
      uv2s,
      normals,
      tangents,
      indices,
      ...(isPoints && { isPoints }),
      ...readMaterial(block),
    });
  }

  // Dropping some surfaces keeps the mesh. Dropping all of them fails, rather
  // than cache an empty geometry that renders invisibly with no placeholder.
  if (declared > 0 && surfaces.length === 0) {
    // Naming the non-triangle count keeps a LINES-only mesh from reading as a
    // byte defect: nothing was corrupt, the geometry just is not triangles.
    const reason = nonTriangle > 0 ? ` (${nonTriangle} skipped as non-triangle)` : '';
    throw new Error(`ArrayMesh ${label}: none of its ${declared} surface(s) could be decoded${reason}`);
  }
  return { surfaces };
}
