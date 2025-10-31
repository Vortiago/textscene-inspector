/**
 * MeshInstance3D renderer - renders MeshInstance3D nodes using three.js.
 */

import * as THREE from 'three';
import type { MeshInstance3DProperties } from './types';
import type { TscnScene } from '../../../parser/types';
import { resolveGeometry, resolveMaterial } from '../../../resources/ResourceManager';
import { warn } from '../../../logger';

/**
 * Create a three.js mesh for a MeshInstance3D node.
 */
export function createMeshInstance3D(
  nodeName: string,
  properties: MeshInstance3DProperties,
  scene?: TscnScene
): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;

  if (scene && properties.mesh) {
    const resolvedGeometry = resolveGeometry(properties.mesh, scene);
    if (resolvedGeometry) {
      geometry = resolvedGeometry;

      // Try to resolve material override for surface 0 (default surface)
      // Handle both Map (parsed) and plain object (from postMessage serialization)
      let materialOverride: string | undefined;
      if (properties.surfaceMaterialOverrides instanceof Map) {
        materialOverride = properties.surfaceMaterialOverrides.get(0);
      } else if (properties.surfaceMaterialOverrides && typeof properties.surfaceMaterialOverrides === 'object') {
        materialOverride = (properties.surfaceMaterialOverrides as Record<number, string>)[0];
      }

      if (materialOverride) {
        const resolvedMaterial = resolveMaterial(materialOverride, scene);
        if (resolvedMaterial) {
          material = resolvedMaterial;
        } else {
          // Fall back to default material if override resolution fails
          material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.3,
            roughness: 0.7,
          });
        }
      } else {
        // No material override, use default gray material
        material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.3,
          roughness: 0.7,
        });
      }
    } else {
      geometry = createPlaceholderGeometry();
      material = createPlaceholderMaterial();
      warn(`MeshInstance3D "${nodeName}": Failed to resolve mesh "${properties.mesh}", using placeholder`);
    }
  } else {
    geometry = createPlaceholderGeometry();
    material = createPlaceholderMaterial();
    if (properties.mesh) {
      warn(`MeshInstance3D "${nodeName}": No scene provided, using placeholder geometry`);
    }
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = nodeName;

  mesh.receiveShadow = true;

  applyShadowCasting(mesh, properties.castShadow);

  return mesh;
}

function createPlaceholderGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

function createPlaceholderMaterial(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
  });
}

/**
 * Apply shadow casting settings based on Godot's ShadowCastingSetting enum.
 */
function applyShadowCasting(mesh: THREE.Mesh, castShadowValue?: number): void {
  if (castShadowValue === undefined || castShadowValue === 0) {
    mesh.castShadow = false;
  } else if (castShadowValue === 1) {
    mesh.castShadow = true;
  } else if (castShadowValue === 2) {
    mesh.castShadow = true;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => {
        mat.shadowSide = THREE.DoubleSide;
      });
    } else {
      mesh.material.shadowSide = THREE.DoubleSide;
    }
  } else if (castShadowValue === 3) {
    mesh.castShadow = true;
    mesh.visible = false;
  }
}
