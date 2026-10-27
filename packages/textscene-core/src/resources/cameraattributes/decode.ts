/**
 * Reads a `CameraAttributesPractical` or `CameraAttributesPhysical` property bag as the renderer
 * does (ADR-0031). The classes share `exposure_multiplier`, which `set_exposure_multiplier` stores
 * unclamped (`scene/resources/camera_attributes.cpp:36-40`), and the auto exposure. Physical adds
 * `exposure_aperture` and `exposure_shutter_speed`, which act only with physical light units
 * (`:56-64`) and so are not read.
 */

import { CAMERA_ATTRIBUTES_DEFAULTS } from '../../godot/scene/cameraAttributes';
import { boolOr, floatOr } from '../../parser/valueParsers';
import type { AutoExposure, CameraAttributes } from './types';

export function decodeCameraAttributes(type: string, data: Record<string, string>): CameraAttributes {
  return {
    exposureMultiplier: readFloat(data, 'exposure_multiplier', CAMERA_ATTRIBUTES_DEFAULTS.exposureMultiplier),
    autoExposure: decodeAutoExposure(type, data),
  };
}

function readFloat(data: Record<string, string>, key: string, fallback: number): number {
  return floatOr(data[key], fallback, `CameraAttributes ${key}`);
}

/** The keys, defaults and conversion of one class's auto exposure range. */
interface LuminanceRange {
  minKey: string;
  maxKey: string;
  minDefault: number;
  maxDefault: number;
  toLuminance: (value: number, sensitivity: number) => number;
}

/** ISO to luminance, as `CameraAttributesPractical::_update_auto_exposure` converts (`:247-255`). */
const PRACTICAL_RANGE: LuminanceRange = {
  minKey: 'auto_exposure_min_sensitivity',
  maxKey: 'auto_exposure_max_sensitivity',
  minDefault: CAMERA_ATTRIBUTES_DEFAULTS.practicalMinSensitivity,
  maxDefault: CAMERA_ATTRIBUTES_DEFAULTS.practicalMaxSensitivity,
  toLuminance: (iso, sensitivity) => iso * (12.5 / 100 / sensitivity),
};

/** EV100 to luminance, as `CameraAttributesPhysical::_update_auto_exposure` converts (`:444-452`). */
const PHYSICAL_RANGE: LuminanceRange = {
  minKey: 'auto_exposure_min_exposure_value',
  maxKey: 'auto_exposure_max_exposure_value',
  minDefault: CAMERA_ATTRIBUTES_DEFAULTS.physicalMinExposureValue,
  maxDefault: CAMERA_ATTRIBUTES_DEFAULTS.physicalMaxExposureValue,
  toLuminance: (exposureValue, sensitivity) => 2 ** exposureValue * (12.5 / sensitivity),
};

function decodeAutoExposure(type: string, data: Record<string, string>): AutoExposure | null {
  if (!boolOr(data.auto_exposure_enabled, false, 'CameraAttributes auto_exposure_enabled')) return null;
  const sensitivity = sensitivityOfLastUpdate(data);
  const range = type === 'CameraAttributesPhysical' ? PHYSICAL_RANGE : PRACTICAL_RANGE;
  return {
    scale: readFloat(data, 'auto_exposure_scale', CAMERA_ATTRIBUTES_DEFAULTS.autoExposureScale),
    minLuminance: range.toLuminance(readFloat(data, range.minKey, range.minDefault), sensitivity),
    maxLuminance: range.toLuminance(readFloat(data, range.maxKey, range.maxDefault), sensitivity),
  };
}

/**
 * The sensitivity the last `auto_exposure_*` setter converts with: `set_exposure_sensitivity` does
 * not update the auto exposure (`camera_attributes.cpp:46-50`), so a sensitivity that follows every
 * `auto_exposure_*` property never reaches the range. Object keys keep the order the file wrote them.
 */
function sensitivityOfLastUpdate(data: Record<string, string>): number {
  const keys = Object.keys(data);
  const lastAutoExposure = keys.reduce(
    (last, key, index) => (key.startsWith('auto_exposure_') ? index : last),
    -1
  );
  return keys.indexOf('exposure_sensitivity') < lastAutoExposure
    ? readFloat(data, 'exposure_sensitivity', CAMERA_ATTRIBUTES_DEFAULTS.exposureSensitivity)
    : CAMERA_ATTRIBUTES_DEFAULTS.exposureSensitivity;
}
