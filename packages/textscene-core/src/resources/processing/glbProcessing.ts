/**
 * Pure functions for GLB/GLTF processing.
 * Extracted from ResourceLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
  return gltf.scene;
}

/**
 * Clone a THREE.Object3D with all materials cloned.
 * CRITICAL: THREE.Object3D can only have ONE parent at a time.
 * Without cloning, multiple instances would share the same object reference,
 * and adding it to a new parent would remove it from the previous parent.
 */
export function cloneWithMaterials(mesh: THREE.Object3D): THREE.Object3D {
  // Clone recursively (true = deep clone including children and geometry)
  const cloned = mesh.clone(true);

  // Clone materials for all meshes in the hierarchy
  // CRITICAL: clone(true) clones Object3D hierarchy but NOT materials
  // Without this, all instances would share material references
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
