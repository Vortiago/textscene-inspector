/**
 * MeshInstance3D-specific type definitions
 */

import type { Node3DProperties } from '../../base/node3d/types';

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

  /** Material that overrides all surface materials */
  materialOverride?: string;

  /** Material applied on top of surface materials */
  materialOverlay?: string;

  /** Shadow casting behavior (0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY) */
  castShadow?: number;

  /** Path to Skeleton3D node for skeletal animation */
  skeleton?: string;

  /** Reference to Skin resource for skeletal animation */
  skin?: string;

  /** Global illumination mode (0=DISABLED, 1=STATIC, 2=DYNAMIC) */
  giMode?: number;

  /** Lightmap detail scale (0=1x, 1=2x, 2=4x, 3=8x) */
  giLightmapScale?: number;

  /** Visibility range start distance (LOD) */
  visibilityRangeBegin?: number;

  /** Fade margin at visibility range start */
  visibilityRangeBeginMargin?: number;

  /** Visibility range end distance (LOD) */
  visibilityRangeEnd?: number;

  /** Fade margin at visibility range end */
  visibilityRangeEndMargin?: number;

  /** Visibility range fade mode (0=DISABLED, 1=SELF, 2=DEPENDENCIES) */
  visibilityRangeFadeMode?: number;

  /** Render layer bitmask (1-1048575 for bits 1-20) */
  layers?: number;
}
