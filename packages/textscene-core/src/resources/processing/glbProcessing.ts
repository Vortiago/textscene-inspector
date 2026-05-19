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
 * Create a THREE.Object3D from GLB/GLTF binary data.
 */
export async function createGLBMesh(data: ArrayBuffer): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(data, '');
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
