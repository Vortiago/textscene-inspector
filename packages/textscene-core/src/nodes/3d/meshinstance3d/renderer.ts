/**
 * MeshInstance3D renderer - renders MeshInstance3D nodes using three.js.
 */

import * as THREE from 'three';
import type { MeshInstance3DProperties } from './types';
import type { TscnScene } from '../../../parser/types';
import { resolveGeometry, resolveMaterial } from '../../../resources/ResourceManager';
import { parseResourceReference } from '../../../resources/ResourceManager';
import { warn, info } from '../../../logger';
/**
 * Threshold for warning about unusually high surface indices.
 * Most meshes have 1-8 surfaces; indices above this may indicate an issue.
 */
const SURFACE_INDEX_WARNING_THRESHOLD = 32;

/**
 * Resolve material attached to a mesh SubResource.
 * Godot allows mesh resources to have a 'material' property that provides a default material.
 * This is distinct from MeshInstance3D material overrides.
 *
 * Material Precedence (Godot-compliant):
 * 1. Mesh material (from mesh SubResource) - Base/default material
 * 2. material_override (from MeshInstance3D) - Overrides all surfaces
 * 3. surface_material_override/N (from MeshInstance3D) - Overrides specific surfaces
 */
async function resolveMeshMaterial(
  meshRef: string,
  scene: TscnScene
): Promise<THREE.Material | null> {
  // Parse mesh reference
  const ref = parseResourceReference(meshRef);
  if (!ref || ref.type !== 'SubResource') {
    return null;
  }

  // Find mesh SubResource
  const meshResource = scene.internalResources.find(r => {
    const resourceId = r.data.id as string | undefined;
    return resourceId === ref.id || String(r.id) === ref.id;
  });

  if (!meshResource) {
    return null;
  }

  // Check if mesh has material property
  const materialRef = meshResource.data.material;
  if (!materialRef || typeof materialRef !== 'string') {
    return null;
  }

  // Resolve the material
  return await resolveMaterial(materialRef, scene);
}

/**
 * Create a three.js mesh for a MeshInstance3D node.
 * Returns Object3D to support both regular meshes (BufferGeometry) and GLB meshes (scene graphs).
 * Now async to support async material resolution (texture loading) and GLB loading.
 */
export async function createMeshInstance3D(
  nodeName: string,
  properties: MeshInstance3DProperties,
  scene?: TscnScene
): Promise<THREE.Object3D> {
  // Check if mesh is an ExtResource pointing to a GLB/GLTF file
  if (scene && properties.mesh) {
    const ref = parseResourceReference(properties.mesh);
    if (ref && ref.type === 'ExtResource' && scene.resourceRegistry) {
      const metadata = scene.resourceRegistry.getMetadata(ref.id);
      if (metadata) {
        const ext = metadata.path.split('.').pop()?.toLowerCase();
        if (ext === 'glb' || ext === 'gltf') {
          // Load GLB mesh as Object3D
          const glbMesh = await scene.resourceRegistry.loadGLBMesh(ref.id);
          if (glbMesh) {
            glbMesh.name = nodeName;
            // GLB meshes come with their own materials and don't support material overrides
            // (Godot imports GLB materials directly)
            applyShadowCastingToObject3D(glbMesh, properties.castShadow);
            return glbMesh;
          } else {
            warn(`MeshInstance3D "${nodeName}": Failed to load GLB mesh "${metadata.path}", using placeholder`);
          }
        }
      }
    }
  }

  // Regular mesh path (SubResource primitive meshes)
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material | THREE.Material[];

  if (scene && properties.mesh) {
    const resolvedGeometry = await resolveGeometry(properties.mesh, scene);
    if (resolvedGeometry) {
      geometry = resolvedGeometry;
      // Try to resolve mesh material first, fallback to default
      const meshMaterial = await resolveMeshMaterial(properties.mesh, scene);
      material = meshMaterial || createDefaultMaterial();
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

  // Set up event subscriptions for progressive material updates (recovery flow)
  if (scene) {
    const cleanup = setupMaterialEventSubscriptions(mesh, properties, scene);
    if (cleanup) {
      mesh.userData.cleanupMaterialListeners = cleanup;
    }
  }

  return mesh;
}

/**
 * Apply material_override and surface_material_override properties.
 * Precedence: surface_material_override/N > material_override > mesh material > default
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

interface MaterialSubscription {
  materialId: string;
  surfaceIndex: number | null; // null = material_override (all surfaces)
}

/** Maps texture slot names to THREE.MeshStandardMaterial property names. */
const TEXTURE_SLOT_MAP: Record<string, string> = {
  'albedo_texture': 'map',
  'normal_texture': 'normalMap',
  'metallic_texture': 'metalnessMap',
  'roughness_texture': 'roughnessMap',
  'ao_texture': 'aoMap',
  'emission_texture': 'emissiveMap',
};

/**
 * Collect material subscriptions from mesh properties with surface index tracking.
 */
function collectMaterialSubscriptions(properties: MeshInstance3DProperties): MaterialSubscription[] {
  const subs: MaterialSubscription[] = [];

  if (properties.materialOverride) {
    const ref = parseResourceReference(properties.materialOverride);
    if (ref) {
      subs.push({ materialId: ref.id, surfaceIndex: null });
    }
  }

  const surfaceOverrides = normalizeSurfaceMaterialOverrides(properties.surfaceMaterialOverrides);
  for (const [surfaceIndex, materialRef] of surfaceOverrides) {
    const ref = parseResourceReference(materialRef);
    if (ref) {
      subs.push({ materialId: ref.id, surfaceIndex });
    }
  }

  return subs;
}

/**
 * Apply a material update to a mesh, respecting surface index.
 */
export function applyMaterialToMesh(
  mesh: THREE.Mesh,
  material: THREE.Material,
  surfaceIndex: number | null
): void {
  if (surfaceIndex === null) {
    mesh.material = material;
    return;
  }

  const materials = Array.isArray(mesh.material)
    ? [...mesh.material]
    : [mesh.material];

  while (materials.length <= surfaceIndex) {
    materials.push(createDefaultMaterial());
  }
  materials[surfaceIndex] = material;
  mesh.material = materials.length === 1 ? materials[0]! : materials;
}

/**
 * Set up event subscriptions for progressive material and texture updates.
 * Handles both material:loaded (ExtResource and SubResource) and texture:loaded (recovery).
 * Returns cleanup function to be stored in mesh.userData.
 */
function setupMaterialEventSubscriptions(
  mesh: THREE.Mesh,
  properties: MeshInstance3DProperties,
  scene: TscnScene
): (() => void) | null {
  if (!scene.resourceRegistry) {
    return null;
  }

  const eventBus = scene.resourceRegistry.getEventBus();
  const materialSubs = collectMaterialSubscriptions(properties);
  const cleanupHandlers: Array<() => void> = [];

  // Material-level subscriptions (for both ExtResource and SubResource materials)
  for (const sub of materialSubs) {
    const handler = (id: string, material?: THREE.Material) => {
      if (id === sub.materialId && material) {
        info(`[MeshInstance3D] Material loaded via event: ${id}, updating mesh "${mesh.name}"`);
        applyMaterialToMesh(mesh, material, sub.surfaceIndex);
      }
    };
    eventBus.on<THREE.Material>('material', 'loaded', handler);
    cleanupHandlers.push(() => eventBus.off<THREE.Material>('material', 'loaded', handler));
  }

  // Texture-level subscriptions for direct texture patching on materials
  // This handles SubResource materials whose textures weren't available at parse time
  const currentMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (currentMaterial && currentMaterial instanceof THREE.MeshStandardMaterial) {
    const matStd = currentMaterial as THREE.MeshStandardMaterial & { userData?: Record<string, unknown> };
    const texDeps = matStd.userData?.textureDependencies as Map<string, string> | undefined;
    if (texDeps) {
      for (const [slotName, textureId] of texDeps) {
        const threeProp = TEXTURE_SLOT_MAP[slotName];
        if (!threeProp) continue;

        // Only subscribe if the texture slot is currently empty
        const currentValue = (matStd as unknown as Record<string, unknown>)[threeProp];
        if (currentValue) continue;

        const handler = (id: string, texture?: THREE.Texture) => {
          if (id === textureId && texture) {
            info(`[MeshInstance3D] Texture loaded via event: ${id}, patching slot "${slotName}" on mesh "${mesh.name}"`);
            (matStd as unknown as Record<string, unknown>)[threeProp] = texture;
            matStd.needsUpdate = true;
          }
        };
        eventBus.on<THREE.Texture>('texture', 'loaded', handler);
        cleanupHandlers.push(() => eventBus.off<THREE.Texture>('texture', 'loaded', handler));
      }
    }
  }

  if (cleanupHandlers.length === 0) {
    return null;
  }

  info(`[MeshInstance3D] Set up ${cleanupHandlers.length} event subscriptions for "${mesh.name}"`);

  return () => {
    for (const cleanup of cleanupHandlers) {
      cleanup();
    }
    info(`[MeshInstance3D] Cleaned up event subscriptions for "${mesh.name}"`);
  };
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

/**
 * Apply shadow casting settings to an Object3D hierarchy (for GLB meshes).
 * Recursively applies settings to all meshes in the scene graph.
 */
function applyShadowCastingToObject3D(object: THREE.Object3D, castShadowValue?: number): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      applyShadowCasting(child, castShadowValue);
    }
  });
}
