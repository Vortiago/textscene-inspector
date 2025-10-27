/**
 * Node3D-specific type definitions
 *
 * Implements vertical slicing for Node3D parsing and rendering
 */

/**
 * Represents a 3D transformation matrix
 *
 * Transform3D(basis_x.x, basis_x.y, basis_x.z, basis_y.x, basis_y.y, basis_y.z, basis_z.x, basis_z.y, basis_z.z, origin.x, origin.y, origin.z)
 *
 * Matrix structure:
 * [ basis_x.x  basis_y.x  basis_z.x  origin.x ]
 * [ basis_x.y  basis_y.y  basis_z.y  origin.y ]
 * [ basis_x.z  basis_y.z  basis_z.z  origin.z ]
 */
export interface Transform3D {
  /** Basis X vector (right) */
  basis_x: { x: number; y: number; z: number };
  /** Basis Y vector (up) */
  basis_y: { x: number; y: number; z: number };
  /** Basis Z vector (forward) */
  basis_z: { x: number; y: number; z: number };
  /** Position/translation */
  origin: { x: number; y: number; z: number };
}

/**
 * Decomposed transform properties
 */
export interface DecomposedTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
  scale: { x: number; y: number; z: number };
}

/**
 * Node3D-specific properties
 */
export interface Node3DProperties {
  /** Node name */
  name: string;
  /** Parent node path ("." for root, "NodeName" for named parent) */
  parent?: string;
  /** Full transform matrix */
  transform?: Transform3D;
  /** Whether this is an instanced scene */
  instance?: string;
}
