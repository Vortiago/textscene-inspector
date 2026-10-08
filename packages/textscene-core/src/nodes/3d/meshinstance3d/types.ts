/** MeshInstance3D type definitions. */

import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';

/** MeshInstance3D node properties. */
export interface MeshInstance3DProperties extends GeometryInstance3DProperties {
  /** The mesh resource reference, a SubResource or an ExtResource. */
  mesh?: string;

  /** Material overrides by surface index. */
  surfaceMaterialOverrides: Map<number, string>;

  /** The material that overrides every surface material. */
  materialOverride?: string;

  /** The material drawn on top of the surface materials. */
  materialOverlay?: string;

  /** The Skeleton3D node path for skeletal animation. */
  skeleton?: string;

  /** The Skin resource reference for skeletal animation. */
  skin?: string;

  /** Global illumination mode (0=DISABLED, 1=STATIC, 2=DYNAMIC). */
  giMode?: number;

  /** Lightmap detail scale (0=1x, 1=2x, 2=4x, 3=8x). */
  giLightmapScale?: number;

  /** Render layer bitmask (32 bits; the editor exposes the first 20). */
  layers?: number;
}
