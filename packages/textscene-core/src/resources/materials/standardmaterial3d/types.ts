/**
 * StandardMaterial3D types for Godot materials.
 */

import type * as THREE from 'three';

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface StandardMaterial3DProperties {
  albedo_color?: Color;
  metallic?: number;
  roughness?: number;
  transparency?: number;

  // Normal map
  normal_enabled?: boolean;

  // Texture maps
  albedo_texture?: THREE.Texture;
  normal_texture?: THREE.Texture;
  metallic_texture?: THREE.Texture;
  roughness_texture?: THREE.Texture;
  ao_texture?: THREE.Texture;
  emission_texture?: THREE.Texture;
}
