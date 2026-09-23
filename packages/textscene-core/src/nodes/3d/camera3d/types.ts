/**
 * Camera3D types and interfaces
 */

import type { Node3DProperties } from '../../base/node3d/types';

export enum ProjectionMode {
  PROJECTION_PERSPECTIVE = 0,
  PROJECTION_ORTHOGONAL = 1,
  PROJECTION_FRUSTUM = 2,
}

/** camera_3d.h:50-53: two members, and no third label exists. */
export enum KeepAspectMode {
  KEEP_WIDTH = 0,
  KEEP_HEIGHT = 1,
}

export interface Camera3DProperties extends Node3DProperties {
  // Projection
  projection: ProjectionMode;

  // Perspective properties
  fov: number;

  // Orthographic properties
  size: number;

  // Common properties
  near: number;
  far: number;
  keep_aspect: KeepAspectMode;

  // Offsets
  h_offset: number;
  v_offset: number;
  frustum_offset: { x: number; y: number };

  // Additional properties
  current: boolean;
  cull_mask: number;
  doppler_tracking: number;
}
