/**
 * `CameraAttributes` resource slice entry point (ADR-0031): the routing claim for both concrete
 * classes, for an inline `[sub_resource]` and a standalone `.tres` alike. It stays THREE-free and
 * React-free.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'cameraattributes',
  kind: 'godot-text',
  typeNames: ['CameraAttributesPractical', 'CameraAttributesPhysical'],
  busType: 'resource',
});

export type { CameraAttributes } from './types';
