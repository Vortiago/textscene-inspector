/**
 * The `CAMERA_ATTRIBUTES` kind: a CameraAttributesPractical or a CameraAttributesPhysical, from
 * any origin. Godot's property refuses any other type (`world_environment.cpp:217`,
 * `camera_3d.cpp:675`). No THREE.
 */

import { CAMERA_ATTRIBUTES_TYPES } from '../../godot/scene/cameraAttributes';
import type { ResourceKind } from '../reading';
import { decodeCameraAttributes } from './decode';
import type { CameraAttributes } from './types';

export const CAMERA_ATTRIBUTES: ResourceKind<CameraAttributes> = {
  name: 'CameraAttributes',
  accepts: (type) => CAMERA_ATTRIBUTES_TYPES.includes(type),
  decode: ({ type, properties }) => decodeCameraAttributes(type, properties),
};
