/**
 * StandardMaterial3D renderer - creates THREE.js materials from StandardMaterial3D properties.
 */

import * as THREE from 'three';
import type { StandardMaterial3DProperties } from './types';
import { info } from '../../../logger';

/**
 * Apply UV transform to texture based on uv1_scale property.
 * In Godot, uv1_scale scales UV coordinates (smaller scale = more repetitions).
 * In THREE.js, texture.repeat scales texture (larger repeat = more repetitions).
 * Conversion: THREE.repeat = 1 / Godot.uv1_scale
 */
function applyUVTransform(texture: THREE.Texture, properties: StandardMaterial3DProperties): void {
  if (properties.uv1_scale) {
    texture.repeat.set(1 / properties.uv1_scale.x, 1 / properties.uv1_scale.y);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    info(
      `[StandardMaterial3D] Applied uv1_scale: (${properties.uv1_scale.x}, ${properties.uv1_scale.y}) -> repeat: (${texture.repeat.x}, ${texture.repeat.y})`
    );
  }
}

/**
 * Create a THREE.MeshStandardMaterial from StandardMaterial3D properties.
 * Maps Godot PBR properties to THREE.js equivalents.
 */
export function createStandardMaterial(properties: StandardMaterial3DProperties): THREE.MeshStandardMaterial {
  const materialOptions: THREE.MeshStandardMaterialParameters = {};

  // Map albedo_color to THREE.js color
  if (properties.albedo_color) {
    const { r, g, b, a } = properties.albedo_color;
    materialOptions.color = new THREE.Color(r, g, b);

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
    materialOptions.map = properties.albedo_texture;
    applyUVTransform(properties.albedo_texture, properties);
  }

  if (properties.normal_enabled && properties.normal_texture) {
    materialOptions.normalMap = properties.normal_texture;
    applyUVTransform(properties.normal_texture, properties);
  }

  if (properties.metallic_texture) {
    materialOptions.metalnessMap = properties.metallic_texture;
    applyUVTransform(properties.metallic_texture, properties);
  }

  if (properties.roughness_texture) {
    materialOptions.roughnessMap = properties.roughness_texture;
    applyUVTransform(properties.roughness_texture, properties);
  }

  if (properties.ao_texture) {
    materialOptions.aoMap = properties.ao_texture;
    applyUVTransform(properties.ao_texture, properties);
  }

  if (properties.emission_enabled && properties.emission_texture) {
    materialOptions.emissiveMap = properties.emission_texture;
    applyUVTransform(properties.emission_texture, properties);
  }

  return new THREE.MeshStandardMaterial(materialOptions);
}
