/**
 * CSGMesh3D's solid, exposed to the boolean evaluator: a port of `CSGMesh3D::_build_brush`
 * (`csg_shape.cpp:1125-1270`). Each face takes the node's `material`, else its surface's own, and
 * is smooth unless its three normals agree.
 */

import type * as THREE from 'three';
import { isEqualApprox } from '../../../../godot/math/math';
import {
  csgSolid,
  type CsgGeometryBuilder,
  type CsgGeometryContext,
  type CsgSolid,
} from '../../../../r3f/csg/csgRegistration';
import { internMaterial, type CsgMaterialAddress } from '../../../../r3f/csg/csgMaterials';
import type { SceneResources } from '../../../../r3f/SceneResourcesContext';
import {
  isDrawableMesh,
  meshContentKey,
  meshKind,
  undrawnMeshType,
} from '../../../../resources/meshes/meshSource';
import {
  primitiveMeshFiles,
  isAwaitingFont,
  primitiveMeshFontFiles,
  referencesKey,
} from '../../../../resources/meshes/primitivemesh/surface';
import { referencedFilePath, resolveReference } from '../../../../resources/resolveReference';
import { findExtResource, parseResourceReference } from '../../../../resources/SubResourceResolver';
import type { LoadedFile } from '../../../../resources/scopedResource';
import { identityKey } from '../../../../utils/identityKey';
import { emptyBrush, shadeCsgFaces } from '../smoothNormals';
import { meshSurfaces, resolveMesh, type CsgMesh, type CsgMeshSurface } from './meshSurfaces';
import type { CSGMesh3DProperties } from './types';

/**
 * Whether an unresolved `meshRef` names no mesh at all, which Godot builds as an empty brush. A
 * file still loading, or declared as a mesh type the previewer cannot read (a `.obj`), is not built.
 */
function namesNoMesh(meshRef: string | undefined, ctx: CsgGeometryContext): boolean {
  if (referencedFilePath(meshRef, ctx) !== null) return false;
  const reference = meshRef ? parseResourceReference(meshRef) : null;
  if (reference?.type !== 'ExtResource') return true;
  const declared = findExtResource(ctx.externalResources, reference.id);
  return declared === undefined || meshKind(declared.type) === null;
}

export const csgMesh3DGeometry: CsgGeometryBuilder = (properties, ctx) => {
  const p = properties as unknown as CSGMesh3DProperties;
  const mesh = meshOf(properties, ctx);
  // A mesh that names nothing builds Godot's empty brush (`csg_shape.cpp:1126-1128`).
  if (!mesh) return namesNoMesh(p.mesh, ctx) ? emptySolid() : null;
  // Not built while the outlines and metrics of its font settle, and the context changes when they have.
  if (!isDrawableMesh(mesh) || isAwaitingFont(mesh)) return null;
  return buildMeshBrush(meshSurfaces(mesh), p.materialPath, p.flipFaces);
};

export function csgMesh3DGeometryKey(properties: Record<string, unknown>, ctx: CsgGeometryContext): string {
  const p = properties as unknown as CSGMesh3DProperties;
  const mesh = meshOf(properties, ctx);
  return `mesh:${p.flipFaces}:${mesh ? meshKey(mesh) : `unresolved:${p.mesh}`}`;
}

/** The mesh the node's `mesh` property names in `ctx`, or null as `resolveMesh` has it. */
function meshOf(properties: Record<string, unknown>, ctx: CsgGeometryContext): CsgMesh | null {
  return resolveMesh((properties as unknown as CSGMesh3DProperties).mesh, ctx);
}

export function csgMesh3DUndrawnMeshType(
  properties: Record<string, unknown>,
  ctx: CsgGeometryContext
): string | null {
  const mesh = meshOf(properties, ctx);
  return mesh && undrawnMeshType(mesh, mesh);
}

export function csgMesh3DReadsFonts(properties: Record<string, unknown>, ctx: CsgGeometryContext): string[] {
  const mesh = meshOf(properties, ctx);
  return mesh ? primitiveMeshFontFiles(mesh, ctx.loadedFont) : [];
}

export function csgMesh3DAwaitsFont(properties: Record<string, unknown>, ctx: CsgGeometryContext): boolean {
  const mesh = meshOf(properties, ctx);
  return mesh !== null && isAwaitingFont(mesh);
}

export function csgMesh3DReadsFiles(
  properties: Record<string, unknown>,
  pools: SceneResources,
  loadedFile: LoadedFile
): string[] {
  const { mesh: meshRef } = properties as unknown as CSGMesh3DProperties;
  const path = referencedFilePath(meshRef, pools);
  const scoped = resolveReference(meshRef, pools, loadedFile);
  // The files a PrimitiveMesh reads join once the mesh itself has loaded.
  return [...(path ? [path] : []), ...(scoped ? primitiveMeshFiles(scoped) : [])];
}

/**
 * A scene mesh keys on its content, and on the resources it builds from, since the parser allocates a
 * fresh one per reparse. A mesh in a file keys on that parse and on the files its build reads.
 */
function meshKey(mesh: CsgMesh): string {
  if (!mesh.file) return meshContentKey(mesh);
  return `${mesh.file.path}#${identityKey(mesh.file.parsed)}|${referencesKey(mesh)}`;
}

/** Godot's empty brush: a closed solid with no face. */
function emptySolid(): CsgSolid {
  return csgSolid(emptyBrush(), []);
}

/** The faces of every surface in turn, with the index of each face's material in `materials`. */
interface MeshFaces {
  positions: Float32Array;
  uvs: Float32Array;
  smooth: boolean[];
  faceMaterials: number[];
  materials: CsgMaterialAddress[];
}

/**
 * The solid of every surface's triangles, each with its material, flipped with `flipFaces`
 * (`csg_shape.cpp:1136-1269`). A mesh with no triangle builds the empty brush (`:1265-1267`).
 */
function buildMeshBrush(
  surfaces: readonly CsgMeshSurface[],
  nodeMaterial: CsgMaterialAddress,
  flipFaces: boolean
): CsgSolid {
  const faces = meshFaces(surfaces, nodeMaterial);
  if (faces.smooth.length === 0) return emptySolid();
  const brush = shadeCsgFaces({ ...faces, invert: flipFaces });
  if (faces.materials.length > 1) addMaterialGroups(brush.geometry, faces.faceMaterials);
  return csgSolid(brush, faces.materials);
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

/** One draw group per run of faces that share a material. `shadeCsgFaces` keeps the face order. */
function addMaterialGroups(geometry: THREE.BufferGeometry, faceMaterials: readonly number[]): void {
  let start = 0;
  for (let face = 1; face <= faceMaterials.length; face++) {
    if (face < faceMaterials.length && faceMaterials[face] === faceMaterials[start]) continue;
    geometry.addGroup(start * 3, (face - start) * 3, faceMaterials[start]);
    start = face;
  }
}
