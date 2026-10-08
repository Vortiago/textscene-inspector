/**
 * CSGMesh3D's solid, exposed to the boolean evaluator: a port of `CSGMesh3D::_build_brush`
 * (`csg_shape.cpp:1125-1270`). Each face takes the node's `material`, else its surface's own, and
 * is smooth unless its three normals agree.
 */

import type * as THREE from 'three';
import { isEqualApprox } from '../../../../godot/math';
import type { CsgGeometryBuilder, CsgGeometryContext, CsgSolid } from '../../../../r3f/csg/csgRegistration';
import { internMaterial, type CsgMaterialAddress } from '../../../../r3f/csg/csgMaterials';
import type { SceneResources } from '../../../../r3f/SceneResourcesContext';
import { resourceContentKey } from '../../../../resources/resourceContentKey';
import { applyCsgNormals } from '../smoothNormals';
import { meshFilePath, meshSurfaces, resolveMesh, type CsgMesh, type CsgMeshSurface } from './meshSurfaces';
import type { CSGMesh3DProperties } from './types';

export const csgMesh3DGeometry: CsgGeometryBuilder = (properties, ctx) => {
  const p = properties as unknown as CSGMesh3DProperties;
  const mesh = resolveMesh(p.mesh, ctx);
  return mesh ? buildMeshBrush(meshSurfaces(mesh), p.materialPath, p.flipFaces) : null;
};

export function csgMesh3DGeometryKey(properties: Record<string, unknown>, ctx: CsgGeometryContext): string {
  const p = properties as unknown as CSGMesh3DProperties;
  const mesh = resolveMesh(p.mesh, ctx);
  return `mesh:${p.flipFaces}:${mesh ? meshKey(mesh) : `unresolved:${p.mesh}`}`;
}

export function csgMesh3DReadsFiles(properties: Record<string, unknown>, pools: SceneResources): string[] {
  const path = meshFilePath((properties as unknown as CSGMesh3DProperties).mesh, pools);
  return path ? [path] : [];
}

/** Written only by `fileKey`. A reload parses a new object, so it takes a new key. */
const fileKeys = new WeakMap<object, number>();
let nextFileKey = 0;

function fileKey(file: object): number {
  let key = fileKeys.get(file);
  if (key === undefined) {
    key = nextFileKey++;
    fileKeys.set(file, key);
  }
  return key;
}

/** A scene mesh keys on its content, since the parser allocates a fresh one per reparse. */
function meshKey(mesh: CsgMesh): string {
  return 'resource' in mesh ? resourceContentKey(mesh.resource) : `${mesh.path}#${fileKey(mesh.file)}`;
}

/** The faces of every surface in turn, with the index of each face's material in `materials`. */
interface MeshFaces {
  positions: Float32Array;
  uvs: Float32Array;
  smooth: boolean[];
  faceMaterials: number[];
  materials: CsgMaterialAddress[];
}

/** Null for a mesh with no faces, which Godot builds as an empty brush (`csg_shape.cpp:1265-1267`). */
function buildMeshBrush(
  surfaces: readonly CsgMeshSurface[],
  nodeMaterial: CsgMaterialAddress,
  flipFaces: boolean
): CsgSolid | null {
  const faces = meshFaces(surfaces, nodeMaterial);
  if (faces.smooth.length === 0) return null;
  const geometry = applyCsgNormals({ ...faces, invert: flipFaces });
  if (faces.materials.length > 1) addMaterialGroups(geometry, faces.faceMaterials);
  return { geometry, materials: faces.materials };
}

function meshFaces(surfaces: readonly CsgMeshSurface[], nodeMaterial: CsgMaterialAddress): MeshFaces {
  const faceCount = surfaces.reduce((n, s) => n + Math.floor(s.indices.length / 3), 0);
  const faces: MeshFaces = {
    positions: new Float32Array(faceCount * 9),
    uvs: new Float32Array(faceCount * 6),
    smooth: [],
    faceMaterials: [],
    materials: [],
  };
  for (const surface of surfaces) {
    // The node's `material` replaces every surface's own (`csg_shape.cpp:1168-1172`).
    const material = internMaterial(faces.materials, nodeMaterial ?? surface.material);
    for (let i = 0; i + 2 < surface.indices.length; i += 3) addFace(faces, surface, i, material);
  }
  return faces;
}

/** One triangle. A missing normal or UV reads as zero, as Godot's unset `Vector3` and `Vector2` do. */
function addFace(faces: MeshFaces, surface: CsgMeshSurface, first: number, material: number): void {
  const face = faces.smooth.length;
  for (let k = 0; k < 3; k++) {
    const vertex = surface.indices[first + k]!;
    for (let axis = 0; axis < 3; axis++)
      faces.positions[face * 9 + k * 3 + axis] = surface.positions[vertex * 3 + axis]!;
    for (let axis = 0; axis < 2; axis++)
      faces.uvs[face * 6 + k * 2 + axis] = surface.uvs?.[vertex * 2 + axis] ?? 0;
  }
  const [a, b, c] = [surface.indices[first]!, surface.indices[first + 1]!, surface.indices[first + 2]!];
  faces.smooth.push(!(normalsAgree(surface.normals, a, b) && normalsAgree(surface.normals, a, c)));
  faces.faceMaterials.push(material);
}

/** One half of `normal[0].is_equal_approx(normal[1]) && normal[0].is_equal_approx(normal[2])` (`csg_shape.cpp:1207`). */
function normalsAgree(normals: Float32Array | undefined, u: number, v: number): boolean {
  if (!normals) return true;
  for (let axis = 0; axis < 3; axis++) {
    if (!isEqualApprox(normals[u * 3 + axis]!, normals[v * 3 + axis]!)) return false;
  }
  return true;
}

/** One draw group per run of faces that share a material. `applyCsgNormals` keeps the face order. */
function addMaterialGroups(geometry: THREE.BufferGeometry, faceMaterials: readonly number[]): void {
  let start = 0;
  for (let face = 1; face <= faceMaterials.length; face++) {
    if (face < faceMaterials.length && faceMaterials[face] === faceMaterials[start]) continue;
    geometry.addGroup(start * 3, (face - start) * 3, faceMaterials[start]);
    start = face;
  }
}
