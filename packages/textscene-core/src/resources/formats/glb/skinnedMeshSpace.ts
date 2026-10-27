/**
 * Puts a skinned mesh in the space Godot gives it: below the Skeleton3D, with its own transform
 * relative to the skeleton. Godot resets the transform the glTF gives the mesh node when it moves
 * the mesh there (`gltf_document.cpp:5919`), and draws the skinned vertices through the mesh's
 * transform in the skeleton's space. Three's attached bind mode cancels the mesh's transform, so
 * the mesh draws detached, with its world matrix `S * O * S^-1` for the skeleton frame `S`.
 */

import * as THREE from 'three';

/** Written only by `skeletonFrame`. A mesh's skeleton does not change once the GLB loads. */
const frameOfMesh = new WeakMap<THREE.SkinnedMesh, THREE.Object3D | null>();

/** Written only by `placeSkinnedMeshInSkeletonSpace`, and never cleared: a placed mesh stays placed. */
const placedMeshes = new WeakSet<THREE.Object3D>();

const frameInverse = new THREE.Matrix4();
const parentInverse = new THREE.Matrix4();

/**
 * The object the Skeleton3D sits below: the parent of the bone nearest the root, which is the first
 * one in tree order when several are equally near. Null for a skeleton with no bone.
 */
function skeletonFrame(mesh: THREE.SkinnedMesh): THREE.Object3D | null {
  if (!frameOfMesh.has(mesh)) {
    const depth = (bone: THREE.Object3D): number => (bone.parent ? depth(bone.parent) + 1 : 0);
    const nearest = mesh.skeleton.bones.reduce<THREE.Bone | undefined>(
      (best, bone) => (!best || depth(bone) < depth(best) ? bone : best),
      undefined
    );
    frameOfMesh.set(mesh, nearest?.parent ?? null);
  }
  return frameOfMesh.get(mesh)!;
}

function updateMatrixInSkeletonSpace(this: THREE.SkinnedMesh): void {
  THREE.Object3D.prototype.updateMatrix.call(this);
  const frame = skeletonFrame(this);
  if (!frame || !this.parent) return;
  // The frame may sit later in tree order, so its matrix would still be last update's.
  frame.updateWorldMatrix(true, false);
  frameInverse.copy(frame.matrixWorld).invert();
  parentInverse.copy(this.parent.matrixWorld).invert();
  // local = parent^-1 * S * O * S^-1, so that world = parent * local = S * O * S^-1.
  this.matrix.premultiply(frame.matrixWorld).multiply(frameInverse).premultiply(parentInverse);
}

/**
 * The matrix Godot gives the node `object` stands for, in `target`. A skinned mesh below a
 * Skeleton3D is the frame times its own transform, where three's world matrix is `S * O * S^-1`.
 * Bounds, and the pose a visibility range measures, ask for this one.
 *
 * @oneWay The Godot world matrix of a node in an instanced GLB, which is not three's for a skinned mesh
 */
export function godotMatrixWorld(object: THREE.Object3D, target: THREE.Matrix4): THREE.Matrix4 {
  const frame = placedMeshes.has(object) ? skeletonFrame(object as THREE.SkinnedMesh) : null;
  if (!frame) return target.copy(object.matrixWorld);
  return target.compose(object.position, object.quaternion, object.scale).premultiply(frame.matrixWorld);
}

/** Call once on a skinned mesh whose Godot node sits below its Skeleton3D. */
export function placeSkinnedMeshInSkeletonSpace(mesh: THREE.SkinnedMesh): void {
  // The identity bind matrix gives the vertices the space Godot reads them in, whatever the glTF
  // transform of the mesh node and its parents were at load.
  mesh.bind(mesh.skeleton, new THREE.Matrix4());
  mesh.bindMode = THREE.DetachedBindMode;
  placedMeshes.add(mesh);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix = updateMatrixInSkeletonSpace;
}
