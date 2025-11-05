/**
 * StandardMaterial3D renderer - creates THREE.js materials from StandardMaterial3D properties.
 */

import * as THREE from 'three';
import type { StandardMaterial3DProperties } from './types';

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

  // Map texture properties
  if (properties.albedo_texture) {
    materialOptions.map = properties.albedo_texture;
  }

  if (properties.normal_texture) {
    materialOptions.normalMap = properties.normal_texture;
  }

  if (properties.metallic_texture) {
    materialOptions.metalnessMap = properties.metallic_texture;
  }

  if (properties.roughness_texture) {
    materialOptions.roughnessMap = properties.roughness_texture;
  }

  if (properties.ao_texture) {
    materialOptions.aoMap = properties.ao_texture;
  }

  if (properties.emission_texture) {
    materialOptions.emissiveMap = properties.emission_texture;
  }

  return new THREE.MeshStandardMaterial(materialOptions);
}
