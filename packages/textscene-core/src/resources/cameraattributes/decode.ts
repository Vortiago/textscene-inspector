/**
 * `decodeCameraAttributes`: a `CameraAttributesPractical` or `CameraAttributesPhysical`'s property
 * bag as the renderer reads it (ADR-0031). The classes share `exposure_multiplier`, which
 * `set_exposure_multiplier` stores unclamped (`scene/resources/camera_attributes.cpp:36-40`). Physical
 * adds `exposure_aperture`, `exposure_shutter_speed` and `exposure_sensitivity`, which act only with
 * physical light units (`:56-64`) and so are not read.
 */

import { CAMERA_ATTRIBUTES_DEFAULTS } from '../../godot/scene/cameraAttributes';
import { floatOr } from '../../parser/valueParsers';
import type { CameraAttributes } from './types';

export function decodeCameraAttributes(data: Record<string, string>): CameraAttributes {
  return {
    exposureMultiplier: floatOr(
      data.exposure_multiplier,
      CAMERA_ATTRIBUTES_DEFAULTS.exposureMultiplier,
      'CameraAttributes exposure_multiplier'
    ),
  };
}
