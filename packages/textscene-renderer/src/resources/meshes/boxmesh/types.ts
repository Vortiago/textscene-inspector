/**
 * BoxMesh-specific type definitions
 */

/**
 * Represents a 3D vector (position, scale, size, etc.)
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * BoxMesh resource properties
 */
export interface BoxMeshProperties {
  /** Box size in Godot units (default: 1, 1, 1) */
  size: Vector3;
}
