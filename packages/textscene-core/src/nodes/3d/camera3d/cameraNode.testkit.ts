/** A Camera3D node at Godot's defaults, for the tests of this slice. */

import type { TscnNode } from '../../../parser/types';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import type { Camera3DProperties } from './types';

export function makeCameraNode(overrides: Partial<Camera3DProperties> = {}): TscnNode {
  const properties: Camera3DProperties = {
    name: 'MyCamera',
    projection: Camera3DProjectionType.PERSPECTIVE,
    fov: 75,
    size: 1,
    near: 0.05,
    far: 4000,
    keep_aspect: Camera3DKeepAspect.KEEP_HEIGHT,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 0xfffff,
    doppler_tracking: 0,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: properties.name ?? 'MyCamera',
    type: 'Camera3D',
    children: [],
    properties,
  };
}
