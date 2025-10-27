/**
 * MeshInstance3D-specific type definitions
 */

import type { Node3DProperties } from '../node3d/types';

/**
 * MeshInstance3D node properties
 *
 * Extends Node3D with mesh rendering capabilities
 */
export interface MeshInstance3DProperties extends Node3DProperties {
  /** Reference to mesh resource (SubResource or ExtResource) */
  mesh?: string;

  /** Material overrides indexed by surface number */
  surfaceMaterialOverrides: Map<number, string>;

  /** Shadow casting behavior (0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY) */
  castShadow?: number;

  /** Path to Skeleton3D node for skeletal animation */
  skeleton?: string;

  /** Reference to Skin resource for skeletal animation */
  skin?: string;
}
