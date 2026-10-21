/**
 * Godot mesh surfaces as one THREE.BufferGeometry, with a draw group per surface so a mesh can
 * attach a material to each. Every mesh source in Godot's arrays goes through here, so the one
 * conversion to three's winding and V lives in one place.
 */

import * as THREE from 'three';
import { bottomUpV } from '../../godot/math/uv.js';
import { UV2_ATTRIBUTE } from './uv2.js';

/** One triangle surface as Godot's mesh arrays hold it: front faces clockwise, UV with V down. */
export interface GodotSurface {
  /** `xyz` per vertex. */
  positions: Float32Array;
  /** `xyz` per vertex, or undefined for a surface with no ARRAY_NORMAL. */
  normals?: Float32Array;
  /** `xyzw` per vertex, `w` the binormal sign, or undefined for a surface with no ARRAY_TANGENT. */
  tangents?: Float32Array;
  /** `uv` per vertex with V down, or undefined for a surface with no ARRAY_TEX_UV. */
  uvs?: Float32Array;
  /** `uv` per vertex with V down, or undefined for a surface with no ARRAY_TEX_UV2. */
  uv2s?: Float32Array;
  /** Three per triangle, and none for a points surface. */
  indices: ArrayLike<number>;
  /** Godot's `PRIMITIVE_POINTS`: one point per vertex, drawn at the material's point size. */
  isPoints?: boolean;
}

/**
 * A mesh draws one primitive type, so a points surface is a mesh's only surface and draws as
 * `THREE.Points`, not as triangles (`pointsGeometry`).
 */
export function godotSurfacesGeometry(surfaces: readonly GodotSurface[]): THREE.BufferGeometry {
  const only = surfaces.length === 1 ? surfaces[0] : undefined;
  if (only?.isPoints) return pointsGeometry(only);
  const geometry = new THREE.BufferGeometry();

  const vertexCountOf = (surface: GodotSurface) => surface.positions.length / 3;
  const totalVertices = surfaces.reduce((n, s) => n + vertexCountOf(s), 0);
  const totalIndices = surfaces.reduce((n, s) => n + s.indices.length, 0);
  const hasUV = surfaces.some((s) => s.uvs);
  // Godot's baked normals and tangents only when every surface has them, else three derives
  // them: mixing the two across groups looks inconsistent.
  const useDecodedNormals = surfaces.length > 0 && surfaces.every((s) => s.normals);
  const useDecodedTangents = surfaces.length > 0 && surfaces.every((s) => s.tangents);

  const positions = new Float32Array(totalVertices * 3);
  const uvs = hasUV ? new Float32Array(totalVertices * 2) : undefined;
  // UV2 keeps Godot's top-down V, which the UV2 binding samples, and a surface without one keeps
  // (0, 0), where Godot samples it.
  const uv2s = surfaces.some((s) => s.uv2s) ? new Float32Array(totalVertices * 2) : undefined;
  const normals = useDecodedNormals ? new Float32Array(totalVertices * 3) : undefined;
  // three builds `vBitangent = cross(normal, tangent) * w`, Godot's binormal
  // (`scene_forward_clustered.glsl:756`), so the tangents pass through as Godot wrote them.
  const tangents = useDecodedTangents ? new Float32Array(totalVertices * 4) : undefined;
  const indices = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vertexBase = 0;
  let indexBase = 0;
  surfaces.forEach((surface, surfaceIndex) => {
    const vertexCount = vertexCountOf(surface);
    const indexCount = surface.indices.length;
    positions.set(surface.positions, vertexBase * 3);
    if (uvs) {
      if (surface.uvs) uvs.set(surface.uvs, vertexBase * 2);
      // Flip the whole range, including a surface with no UVs of its own: `hasUV`
      // is `some`, so the buffer spans it, and Godot samples it at UV (0,0), the
      // image's top-left. Flipping only the written surfaces mixes two V spaces.
      for (let i = 0; i < vertexCount; i++) {
        const v = (vertexBase + i) * 2 + 1;
        uvs[v] = bottomUpV(uvs[v]!);
      }
    }
    if (uv2s && surface.uv2s) uv2s.set(surface.uv2s, vertexBase * 2);
    if (normals && surface.normals) normals.set(surface.normals, vertexBase * 3);
    if (tangents && surface.tangents) tangents.set(surface.tangents, vertexBase * 4);
    // Re-base each surface's indices into the merged vertex array and reverse
    // each triangle's winding: Godot fronts triangles clockwise and three.js
    // counter-clockwise, so without the swap every face is back-culled.
    for (let i = 0; i + 2 < indexCount; i += 3) {
      indices[indexBase + i] = surface.indices[i]! + vertexBase;
      indices[indexBase + i + 1] = surface.indices[i + 2]! + vertexBase;
      indices[indexBase + i + 2] = surface.indices[i + 1]! + vertexBase;
    }
    geometry.addGroup(indexBase, indexCount, surfaceIndex);
    vertexBase += vertexCount;
    indexBase += indexCount;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (uv2s) geometry.setAttribute(UV2_ATTRIBUTE, new THREE.BufferAttribute(uv2s, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (tangents) geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));

  return geometry;
}

/**
 * What Godot lights a surface with no ARRAY_NORMAL with, in node space. Measured with `pnpm ref:godot`
 * under ten light directions, not read from the (1, 0, 0) its default buffer holds (`mesh_storage.cpp:61-70`).
 */
const DEFAULT_NORMAL = [0, 0, 1];

/** A points surface: its vertices, each with the surface's normal or Godot's default. */
function pointsGeometry({ positions, normals }: GodotSurface): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const vertexCount = positions.length / 3;
  geometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(
      normals ?? Float32Array.from({ length: vertexCount * 3 }, (_, i) => DEFAULT_NORMAL[i % 3]!),
      3
    )
  );
  return geometry;
}
