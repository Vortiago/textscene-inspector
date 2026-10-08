/**
 * The objects of a loaded glTF that Godot's importer makes a MeshInstance3D, a GeometryInstance3D,
 * and the surfaces each draws. GLTFLoader makes a mesh of one primitive a Mesh and a mesh of
 * several a Group of one Mesh per primitive, so a tag in `userData`, which a clone copies, marks
 * the object that stands for the glTF mesh.
 */

import type * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';

/** A surface of a MeshInstance3D: a Mesh, or a Points or Line for a non-triangle primitive. */
export type MeshSurface = THREE.Object3D & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
};

const MESH_INSTANCE_KEY = 'textsceneMeshInstance';

/**
 * Tags each object under `root` that stands for a glTF node's mesh, from the parser's
 * `associations`. A primitive Mesh of a Group is the Group's surface, unless it is a node itself.
 */
export function tagMeshInstances(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>
): void {
  root.traverse((object) => {
    const association = associations.get(object);
    if (association?.meshes === undefined) return;
    const isPrimitive = association.nodes === undefined && isPrimitiveGroup(associations.get(object.parent));
    if (!isPrimitive) object.userData[MESH_INSTANCE_KEY] = true;
  });
}

/** Whether GLTFLoader built the object for a mesh of several primitives. */
function isPrimitiveGroup(association: GLTFReference | undefined): boolean {
  return association?.meshes !== undefined && association.primitives === undefined;
}

/** Whether Godot imports `object` as a MeshInstance3D. */
export function isMeshInstance(object: THREE.Object3D): boolean {
  return object.userData[MESH_INSTANCE_KEY] === true;
}

/** The surfaces a MeshInstance3D object draws, or none for any other object. */
export function meshInstanceSurfaces(object: THREE.Object3D): MeshSurface[] {
  if (!isMeshInstance(object)) return [];
  if (isSurface(object)) return [object];
  return object.children.filter((child): child is MeshSurface => !isMeshInstance(child) && isSurface(child));
}

function isSurface(object: THREE.Object3D): object is MeshSurface {
  const { geometry, material } = object as Partial<MeshSurface>;
  return geometry !== undefined && material !== undefined;
}
