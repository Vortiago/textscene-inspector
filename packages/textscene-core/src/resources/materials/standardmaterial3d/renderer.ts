/**
 * StandardMaterial3D renderer - creates THREE.js materials from StandardMaterial3D properties.
 */

import * as THREE from 'three';
import type { StandardMaterial3DProperties } from './types';
import { info } from '../../../logger';

/**
 * Apply UV transform to texture based on uv1_scale property.
 * In Godot: UV = UV * uv1_scale (higher scale = more tiling)
 * In THREE.js: texture.repeat (higher repeat = more tiling)
 * Conversion: THREE.repeat = Godot.uv1_scale (direct mapping)
 *
 * Returns a cloned texture with the UV transform applied if uv1_scale is set,
 * otherwise returns the original texture.
 */
function applyUVTransform(texture: THREE.Texture, properties: StandardMaterial3DProperties): THREE.Texture {
  if (properties.uv1_scale) {
    // Clone the texture to avoid modifying the shared cached instance
    const clonedTexture = texture.clone();
    clonedTexture.repeat.set(properties.uv1_scale.x, properties.uv1_scale.y);
    clonedTexture.wrapS = THREE.RepeatWrapping;
    clonedTexture.wrapT = THREE.RepeatWrapping;
    clonedTexture.needsUpdate = true;

    info(
      `[StandardMaterial3D] Applied uv1_scale: (${properties.uv1_scale.x}, ${properties.uv1_scale.y}) -> repeat: (${clonedTexture.repeat.x}, ${clonedTexture.repeat.y})`
    );

    return clonedTexture;
  }

  return texture;
}

/**
 * Create a THREE.MeshStandardMaterial from StandardMaterial3D properties.
 * Maps Godot PBR properties to THREE.js equivalents.
 */
export function createStandardMaterial(properties: StandardMaterial3DProperties): THREE.MeshStandardMaterial {
  const materialOptions: THREE.MeshStandardMaterialParameters = {};

  // Map albedo_color to THREE.js color. WI-HALL-2: Godot stores colors
  // in sRGB; three.js treats `new THREE.Color(r,g,b)` arguments as
  // linear. Without the conversion, mid-tone reds (e.g. Color(0.545,
  // 0.117, 0.117, 1) — dark red #8B1E1E in Godot) render as bright
  // saturated pink. Call `convertSRGBToLinear()` to undo the implicit
  // linearisation that three.js's shader output otherwise re-applies
  // via the renderer's outputColorSpace = SRGB.
  if (properties.albedo_color) {
    const { r, g, b, a } = properties.albedo_color;
    materialOptions.color = new THREE.Color(r, g, b).convertSRGBToLinear();

    // Handle transparency
    if (a < 1.0) {
      materialOptions.transparent = true;
      materialOptions.opacity = a;
    }
  }

  // Map metallic property (Godot and THREE.js both use 0-1 range)
  if (properties.metallic !== undefined) {
    materialOptions.metalness = properties.metallic;
  }

  // Map roughness property (Godot and THREE.js both use 0-1 range)
  if (properties.roughness !== undefined) {
    materialOptions.roughness = properties.roughness;
  }

  // Map texture properties and apply UV transforms
  if (properties.albedo_texture) {
    materialOptions.map = applyUVTransform(properties.albedo_texture, properties);
  }

  if (properties.normal_enabled && properties.normal_texture) {
    materialOptions.normalMap = applyUVTransform(properties.normal_texture, properties);
  }

  if (properties.metallic_texture) {
    materialOptions.metalnessMap = applyUVTransform(properties.metallic_texture, properties);
  }

  if (properties.roughness_texture) {
    materialOptions.roughnessMap = applyUVTransform(properties.roughness_texture, properties);
  }

  if (properties.ao_texture) {
    materialOptions.aoMap = applyUVTransform(properties.ao_texture, properties);
  }

  if (properties.emission_enabled && properties.emission_texture) {
    materialOptions.emissiveMap = applyUVTransform(properties.emission_texture, properties);
  }

  return new THREE.MeshStandardMaterial(materialOptions);
}
