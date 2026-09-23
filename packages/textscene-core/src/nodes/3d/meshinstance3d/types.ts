/** MeshInstance3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';

/** MeshInstance3D node properties. */
export interface MeshInstance3DProperties extends Node3DProperties {
  /** The mesh resource reference, a SubResource or an ExtResource. */
  mesh?: string;

  /** Material overrides by surface index. */
  surfaceMaterialOverrides: Map<number, string>;

  /** The material that overrides every surface material. */
  materialOverride?: string;

  /** The material drawn on top of the surface materials. */
  materialOverlay?: string;

  /** Shadow casting (0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY). */
  castShadow?: number;

  /** The Skeleton3D node path for skeletal animation. */
  skeleton?: string;

  /** The Skin resource reference for skeletal animation. */
  skin?: string;

  /** Global illumination mode (0=DISABLED, 1=STATIC, 2=DYNAMIC). */
  giMode?: number;

  /** Lightmap detail scale (0=1x, 1=2x, 2=4x, 3=8x). */
  giLightmapScale?: number;

  /** Visibility range start distance, for LOD. */
  visibilityRangeBegin?: number;

  /** Fade margin at the visibility range start. */
  visibilityRangeBeginMargin?: number;

  /** Visibility range end distance, for LOD. */
  visibilityRangeEnd?: number;

  /** Fade margin at the visibility range end. */
  visibilityRangeEndMargin?: number;

  /** Visibility range fade mode (0=DISABLED, 1=SELF, 2=DEPENDENCIES). */
  visibilityRangeFadeMode?: number;

  /** Render layer bitmask (32 bits; the editor exposes the first 20). */
  layers?: number;
}
