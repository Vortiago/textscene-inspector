/** MeshInstance3D type definitions. */

import type { Transform3D } from '../../../godot/math/transform3d';
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

  /**
   * One matrix for each bone of the Skeleton3D `skeleton` names, in mesh space: the global pose of the
   * bone times its bind pose in the automatic skin. Written by the Skeleton3D scene pass. Unset for a
   * mesh that binds no skeleton.
   */
  skinMatrices?: readonly Transform3D[];

  /** Global illumination mode (0=DISABLED, 1=STATIC, 2=DYNAMIC). */
  giMode?: number;

  /** Lightmap detail scale (0=1x, 1=2x, 2=4x, 3=8x). */
  giLightmapScale?: number;
}
