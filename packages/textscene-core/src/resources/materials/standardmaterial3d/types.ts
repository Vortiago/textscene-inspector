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

  // Feature enable flags
  normal_enabled?: boolean;
  emission_enabled?: boolean;

  // Emission. Godot's `emission` defaults to BLACK, so an absent colour is not
  // "unset, fall back to white" — it means the emission texture carries the
  // whole signal (see `emission.ts` for how the operator resolves that).
  emission?: Color;
  emission_energy_multiplier?: number;
  /** Godot `emission_operator`: 0 ADD (default), 1 MULTIPLY. */
  emission_operator?: number;

  // UV transform
  uv1_scale?: { x: number; y: number; z: number };

  /**
   * Godot `BaseMaterial3D.texture_filter` — the sampler state every texture
   * slot on this material samples with. Absent means Godot's default
   * (LINEAR_WITH_MIPMAPS), which is three's default too, so it costs nothing.
   */
  texture_filter?: number;

  // Texture maps
  albedo_texture?: THREE.Texture;
  normal_texture?: THREE.Texture;
  metallic_texture?: THREE.Texture;
  roughness_texture?: THREE.Texture;
  ao_texture?: THREE.Texture;
  emission_texture?: THREE.Texture;
}
