/**
 * Camera3D types and interfaces
 */

import type { Node3DProperties } from '../../base/node3d/types';
import { Camera3DProjectionType, Camera3DKeepAspect } from '../../../godot/scene/camera3d';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface Camera3DProperties extends Node3DProperties {
  // Projection
  projection: EnumValue<typeof Camera3DProjectionType>;

  // Perspective properties
  fov: number;

  // Orthographic properties
  size: number;

  // Common properties
  near: number;
  far: number;
  keep_aspect: EnumValue<typeof Camera3DKeepAspect>;

  // Offsets
  h_offset: number;
  v_offset: number;
  frustum_offset: { x: number; y: number };

  // Additional properties
  current: boolean;
  /**
   * Reference to a CameraAttributesPractical or CameraAttributesPhysical (optional), in the
   * `SubResource("id")` or the `ExtResource("id")` form. Its `exposure_multiplier` scales the frame
   * while the viewport renders through this camera (`r3f/environment/worldExposure.tsx`).
   */
  attributes?: string;
  /**
   * Reference to an Environment (optional), in the `SubResource("id")` or the `ExtResource("id")`
   * form. It replaces the world's Environment while the viewport renders through this camera.
   */
  environment?: string;
  cull_mask: number;
  doppler_tracking: number;
}
