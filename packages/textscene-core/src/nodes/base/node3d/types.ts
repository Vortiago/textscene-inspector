/** Node3D type definitions. */

import type { Transform3D } from '../../../godot/math/transform3d.js';

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
  /**
   * The `visibility_parent` path text, relative to this node. Unset when the file omits it or
   * leaves it empty, where the node takes its Node3D parent's visibility parent.
   */
  visibility_parent?: string;
}
