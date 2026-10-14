/**
 * Builds one THREE.BufferGeometry from decoded ArrayMesh surfaces, with a draw
 * group per surface so the MeshInstance3D can attach a material to each.
 */

import * as THREE from 'three';
import type { ArrayMeshData } from './types.js';
import { bottomUpV } from '../../../godot/uv.js';
import { UV2_ATTRIBUTE } from '../uv2.js';

export function buildArrayMeshGeometry(mesh: ArrayMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const totalVertices = mesh.surfaces.reduce((n, s) => n + s.vertexCount, 0);
  const totalIndices = mesh.surfaces.reduce((n, s) => n + s.indexCount, 0);
  const hasUV = mesh.surfaces.some((s) => s.uvs);
  // Godot's baked normals only when every surface has them, else
  // `computeVertexNormals`: mixing the two across groups looks inconsistent.
  const useDecodedNormals = mesh.surfaces.length > 0 && mesh.surfaces.every((s) => s.normals);

  const positions = new Float32Array(totalVertices * 3);
  const uvs = hasUV ? new Float32Array(totalVertices * 2) : undefined;
  // UV2 keeps Godot's top-down V, which the UV2 binding samples, and a surface without one keeps
  // (0, 0), where Godot samples it.
  const uv2s = mesh.surfaces.some((s) => s.uv2s) ? new Float32Array(totalVertices * 2) : undefined;
  const normals = useDecodedNormals ? new Float32Array(totalVertices * 3) : undefined;
  const indices = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vertexBase = 0;
  let indexBase = 0;
  mesh.surfaces.forEach((surface, surfaceIndex) => {
    positions.set(surface.positions, vertexBase * 3);
    if (uvs) {
      if (surface.uvs) uvs.set(surface.uvs, vertexBase * 2);
      // Flip the whole range, including a surface with no UVs of its own: `hasUV`
      // is `some`, so the buffer spans it, and Godot samples it at UV (0,0), the
      // image's top-left. Flipping only the written surfaces mixes two V spaces.
      for (let i = 0; i < surface.vertexCount; i++) {
        const v = (vertexBase + i) * 2 + 1;
        uvs[v] = bottomUpV(uvs[v]!);
      }
    }
    if (uv2s && surface.uv2s) uv2s.set(surface.uv2s, vertexBase * 2);
    if (normals && surface.normals) normals.set(surface.normals, vertexBase * 3);
    // Re-base each surface's indices into the merged vertex array and reverse
    // each triangle's winding: Godot fronts triangles clockwise and three.js
    // counter-clockwise, so without the swap every face is back-culled.
    for (let i = 0; i + 2 < surface.indexCount; i += 3) {
      indices[indexBase + i] = surface.indices[i]! + vertexBase;
      indices[indexBase + i + 1] = surface.indices[i + 2]! + vertexBase;
      indices[indexBase + i + 2] = surface.indices[i + 1]! + vertexBase;
    }
    geometry.addGroup(indexBase, surface.indexCount, surfaceIndex);
    vertexBase += surface.vertexCount;
    indexBase += surface.indexCount;
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

  return geometry;
}
