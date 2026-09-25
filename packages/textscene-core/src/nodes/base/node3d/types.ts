/** Node3D type definitions. */

/**
 * A 3D transform, written `Transform3D(basis_x.xyz, basis_y.xyz, basis_z.xyz, origin.xyz)`.
 * Godot stores Basis as `Vector3 rows[3]`: basis_x, basis_y and basis_z are the rows of the 3×3
 * matrix, not the columns (utils/transform.ts has the convention), and origin is the fourth column.
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
  /** Child index for editable instance overrides (for example parent="." index="0") */
  index?: number;
  /** Whether the node and its subtree are rendered. Defaults to true. */
  visible?: boolean;
  /**
   * Whether the global transform skips the parent: `global = local` (`node_3d.cpp:656-660`).
   * Visibility still climbs the parent (`:1132-1143`). Unset when the file omits it.
   */
  top_level?: boolean;
}
