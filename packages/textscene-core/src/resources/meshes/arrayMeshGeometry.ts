/**
 * Builds a single THREE.BufferGeometry from decoded ArrayMesh surfaces.
 *
 * All surfaces are merged into one geometry; each contributes a draw group
 * (`addGroup`) so the MeshInstance3D can attach a material per surface. Godot's
 * decoded per-vertex normals are used when every surface carries them;
 * otherwise three.js recomputes them (`computeVertexNormals`) as a fallback.
 */

import * as THREE from 'three';
import type { ArrayMeshData } from './arrayMeshDecode.js';

export function buildArrayMeshGeometry(mesh: ArrayMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const totalVertices = mesh.surfaces.reduce((n, s) => n + s.vertexCount, 0);
  const totalIndices = mesh.surfaces.reduce((n, s) => n + s.indexCount, 0);
  const hasUV = mesh.surfaces.some((s) => s.uvs);
  // Use Godot's baked normals only when every surface has them — mixing decoded
  // and recomputed normals across groups would look inconsistent.
  const useDecodedNormals = mesh.surfaces.length > 0 && mesh.surfaces.every((s) => s.normals);

  const positions = new Float32Array(totalVertices * 3);
  const uvs = hasUV ? new Float32Array(totalVertices * 2) : undefined;
  const normals = useDecodedNormals ? new Float32Array(totalVertices * 3) : undefined;
  const indices =
    totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vertexBase = 0;
  let indexBase = 0;
  mesh.surfaces.forEach((surface, surfaceIndex) => {
    positions.set(surface.positions, vertexBase * 3);
    // Godot's UV origin is the image's TOP-left; textures load here with THREE's
    // default flipY=true (the convention `spriteFrame.ts` and `tileGeometry.ts`
    // build their UVs for), which uploads the image bottom-up. Handing Godot's V
    // through unchanged therefore samples the texture vertically mirrored —
    // every tile of an atlas lands on the wrong row.
    if (uvs && surface.uvs) {
      uvs.set(surface.uvs, vertexBase * 2);
      for (let i = 0; i < surface.vertexCount; i++) {
        const v = (vertexBase + i) * 2 + 1;
        uvs[v] = 1 - uvs[v]!;
      }
    }
    if (normals && surface.normals) normals.set(surface.normals, vertexBase * 3);
    // Re-base each surface's indices into the merged vertex array AND reverse
    // each triangle's winding: Godot fronts triangles clockwise, three.js
    // expects counter-clockwise, so without this swap every face is back-culled
    // (flat meshes vanish; closed meshes render inside-out).
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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  return geometry;
}
