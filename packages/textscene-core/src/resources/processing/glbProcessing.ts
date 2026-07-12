/**
 * Pure functions for GLB/GLTF processing.
 * Extracted from ResourceLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Check if a path is a GLB/GLTF file.
 */
export function isGLBPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'glb' || ext === 'gltf';
}

/**
 * The directory a glTF's relative dependencies (external .bin buffers,
 * image files) resolve against — `res://stage/model.gltf` → `res://stage/`.
 */
export function gltfResourceDir(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash + 1);
}

/**
 * Create a THREE.Object3D from GLB/GLTF data. Binary .glb is self-contained;
 * a TEXT .gltf references external buffers/images relative to its own
 * directory — `resourcePath` carries that res:// directory and `manager`
 * (the bus's THREE.LoadingManager) lets the HOST map those res:// URLs onto
 * fetchable ones (the web app points them at its fixtures mirror via
 * setURLModifier; hosts without a mapping fail the load → standard
 * missing-resource placeholder UX).
 */
export async function createGLBMesh(
  data: ArrayBuffer,
  resourcePath = '',
  manager?: THREE.LoadingManager
): Promise<THREE.Object3D> {
  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(data, resourcePath);
  // GLTFLoader returns embedded clips on `gltf.animations`, not on the scene
  // object. Attach them to the scene's conventional `.animations` array so the
  // GLB animation driver (GLBSceneRoot) can surface and play them — and so the
  // per-consumer `cloneWithMaterials` carries them onto each instance.
  gltf.scene.animations = gltf.animations;
  return gltf.scene;
}

/**
 * Clone a THREE.Object3D with all materials cloned.
 * CRITICAL: THREE.Object3D can only have ONE parent at a time.
 * Without cloning, multiple instances would share the same object reference,
 * and adding it to a new parent would remove it from the previous parent.
 *
 * Uses SkeletonUtils.clone, not Object3D.clone(true): a plain clone leaves a
 * cloned SkinnedMesh's `.skeleton` bound to the SOURCE bones, so animating one
 * GLB instance would deform the cached template (and every other instance).
 * SkeletonUtils rebinds each cloned SkinnedMesh to its cloned bones, which is
 * load-bearing for GLB-embedded animation playback. It also copies the
 * convention `.animations` array onto the clone so the GLB-embedded clips ride
 * along (pinned by tests), but still shares material references — so we clone
 * materials explicitly below, as the old plain-clone path did.
 */
export function cloneWithMaterials(mesh: THREE.Object3D): THREE.Object3D {
  const cloned = cloneSkeleton(mesh);

  // SkeletonUtils shares material references between source and clone; clone
  // them so per-instance material mutations don't bleed across instances.
  cloned.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((mat) => mat.clone());
      } else {
        node.material = node.material.clone();
      }
    }
  });

  return cloned;
}

/**
 * Dispose the per-consumer materials created by `cloneWithMaterials`.
 *
 * CRITICAL: geometry is deliberately NOT disposed here. `cloneWithMaterials`
 * clones materials but shares geometry by reference with the source template
 * (and therefore with every other consumer's clone) — disposing geometry
 * would break the cached template and any sibling consumer still mounted.
 * Only the cloned materials are exclusively owned by this one consumer, so
 * only they are safe (and necessary) to release when the consumer unmounts
 * or swaps to a different resource.
 */
export function disposeClonedMaterials(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      disposeMeshMaterials(node);
    }
  });
}

/**
 * Dispose one mesh's material slot — the ONE place that owns the
 * array-vs-single material branch, shared by the per-consumer clone
 * disposal above and the template disposal in `createGLBProcessor`.
 */
export function disposeMeshMaterials(mesh: THREE.Mesh): void {
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat.dispose());
  } else {
    mesh.material?.dispose();
  }
}
