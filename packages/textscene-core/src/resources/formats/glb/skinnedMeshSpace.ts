/**
 * Puts a skinned mesh in the space Godot gives it: below the Skeleton3D, with its own transform
 * relative to the skeleton (Godot resets the mesh node's glTF transform there, `gltf_document.cpp:5919`).
 * Three's attached bind mode cancels the mesh's transform, so the mesh draws detached, with its
 * world matrix `S * O * S^-1` for the skeleton frame `S`.
 */

import * as THREE from 'three';

/**
 * The meshes `placeSkinnedMeshInSkeletonSpace` placed, never cleared: a placed mesh stays placed.
 * The value is the mesh's frame, which `skeletonFrame` writes on its first ask, because a skeleton
 * does not change once the GLB loads. Undefined until then, and null for a skeleton with no bone.
 */
// eslint-disable-next-line no-restricted-syntax -- placeSkinnedMeshInSkeletonSpace writes an entry from outside, and skeletonFrame replaces it
const frameOfPlacedMesh = new WeakMap<THREE.Object3D, THREE.Object3D | null | undefined>();

const frameInverse = new THREE.Matrix4();
const parentInverse = new THREE.Matrix4();

/**
 * The object the Skeleton3D sits below: the parent of the bone nearest the root, which is the first
 * one in the skeleton's bone order when several are equally near. Null for a skeleton with no bone.
 */
function skeletonFrame(mesh: THREE.SkinnedMesh): THREE.Object3D | null {
  const known = frameOfPlacedMesh.get(mesh);
  if (known !== undefined) return known;
  const depth = (bone: THREE.Object3D): number => (bone.parent ? depth(bone.parent) + 1 : 0);
  const nearest = mesh.skeleton.bones.reduce<THREE.Bone | undefined>(
    (best, bone) => (!best || depth(bone) < depth(best) ? bone : best),
    undefined
  );
  const frame = nearest?.parent ?? null;
  frameOfPlacedMesh.set(mesh, frame);
  return frame;
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
 * @canonical The Godot world matrix of a node in an instanced GLB, which is not three's for a skinned mesh
 */
export function godotMatrixWorld(object: THREE.Object3D, target: THREE.Matrix4): THREE.Matrix4 {
  const frame = frameOfPlacedMesh.has(object) ? skeletonFrame(object as THREE.SkinnedMesh) : null;
  if (!frame) return target.copy(object.matrixWorld);
  return target.compose(object.position, object.quaternion, object.scale).premultiply(frame.matrixWorld);
}

/** Call once on a skinned mesh whose Godot node sits below its Skeleton3D. */
export function placeSkinnedMeshInSkeletonSpace(mesh: THREE.SkinnedMesh): void {
  // The identity bind matrix gives the vertices the space Godot reads them in, whatever the glTF
  // transform of the mesh node and its parents were at load.
  mesh.bind(mesh.skeleton, new THREE.Matrix4());
  mesh.bindMode = THREE.DetachedBindMode;
  frameOfPlacedMesh.set(mesh, undefined);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix = updateMatrixInSkeletonSpace;
}
