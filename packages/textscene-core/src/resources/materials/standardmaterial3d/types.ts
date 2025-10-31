/**
 * StandardMaterial3D types for Godot materials.
 */

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
}
