/**
 * MeshInstance3D renderer - renders MeshInstance3D nodes using three.js.
 */

import * as THREE from 'three';
import type { MeshInstance3DProperties } from './types';
import type { TscnScene } from '../../../parser/types';
import { resolveGeometry, resolveMaterial } from '../../../resources/ResourceManager';
import { warn } from '../../../logger';

/**
 * Threshold for warning about unusually high surface indices.
 * Most meshes have 1-8 surfaces; indices above this may indicate an issue.
 */
const SURFACE_INDEX_WARNING_THRESHOLD = 32;

/**
 * Create a three.js mesh for a MeshInstance3D node.
 * Now async to support async material resolution (texture loading).
 */
export async function createMeshInstance3D(
  nodeName: string,
  properties: MeshInstance3DProperties,
  scene?: TscnScene
): Promise<THREE.Mesh> {
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material | THREE.Material[];

  if (scene && properties.mesh) {
    const resolvedGeometry = await resolveGeometry(properties.mesh, scene);
    if (resolvedGeometry) {
      geometry = resolvedGeometry;
      material = createDefaultMaterial();
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

  // Apply material overrides if scene is available
  if (scene && properties.mesh) {
    await applyMaterialOverrides(mesh, properties, scene);
  }

  mesh.receiveShadow = true;

  applyShadowCasting(mesh, properties.castShadow);

  return mesh;
}

/**
 * Apply material_override and surface_material_override properties.
 * Precedence: surface_material_override/N > material_override > default
 */
async function applyMaterialOverrides(
  mesh: THREE.Mesh,
  properties: MeshInstance3DProperties,
  scene: TscnScene
): Promise<void> {
  // Step 1: Apply material_override to all surfaces (if specified)
  if (properties.materialOverride) {
    const material = await resolveMaterial(properties.materialOverride, scene);
    if (material) {
      mesh.material = material;
    }
  }

  // Step 2: Apply surface_material_override/N to specific surfaces (takes precedence)
  const surfaceOverrides = normalizeSurfaceMaterialOverrides(properties.surfaceMaterialOverrides);

  if (surfaceOverrides.size > 0) {
    // Ensure material is an array for multi-surface support
    const materials = Array.isArray(mesh.material)
      ? [...mesh.material]
      : [mesh.material];

    // Apply each surface-specific override
    for (const [surfaceIndex, materialRef] of surfaceOverrides) {
      const material = await resolveMaterial(materialRef, scene);
      if (material) {
        // Expand materials array if needed
        while (materials.length <= surfaceIndex) {
          materials.push(createDefaultMaterial());
        }
        materials[surfaceIndex] = material;
      }
    }

    // Update mesh material (materials[0] is guaranteed to exist)
    mesh.material = materials.length === 1 ? materials[0]! : materials;
  }
}

/**
 * Normalize surfaceMaterialOverrides to Map format.
 * Handles both Map (from parser) and plain object (from postMessage serialization).
 * Rejects negative indices; warns about unusually high indices.
 */
function normalizeSurfaceMaterialOverrides(
  overrides: Map<number, string> | Record<number, string> | undefined
): Map<number, string> {
  if (!overrides) {
    return new Map();
  }

  const map = new Map<number, string>();

  // Handle Map format
  if (overrides instanceof Map) {
    for (const [index, value] of overrides) {
      if (index < 0) {
        warn(`Surface material override index ${index} is negative, skipping`);
        continue;
      }
      if (index > SURFACE_INDEX_WARNING_THRESHOLD) {
        warn(`Surface material override index ${index} is unusually high (most meshes have < 32 surfaces), may impact performance`);
      }
      map.set(index, value);
    }
    return map;
  }

  // Handle plain object format
  for (const [key, value] of Object.entries(overrides)) {
    const index = parseInt(key, 10);
    if (isNaN(index)) {
      continue;
    }
    if (index < 0) {
      warn(`Surface material override index ${index} is negative, skipping`);
      continue;
    }
    if (index > SURFACE_INDEX_WARNING_THRESHOLD) {
      warn(`Surface material override index ${index} is unusually high (most meshes have < 32 surfaces), may impact performance`);
    }
    map.set(index, value);
  }
  return map;
}

function createDefaultMaterial(): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.3,
    roughness: 0.7,
  });
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
