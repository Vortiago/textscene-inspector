/** How a BaseMaterial3D fades with distance. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::DistanceFadeMode` (`scene/resources/material.h:323-329`), as the integers a
 * `.tscn` stores for `distance_fade_mode`. The default is DISABLED (`material.h:597`).
 */
export enum DistanceFadeMode {
  DISABLED = 0,
  PIXEL_ALPHA = 1,
  PIXEL_DITHER = 2,
  OBJECT_DITHER = 3,
}

export const DISTANCE_FADE_MODE_NAMES = enumNamesByValue(DistanceFadeMode);
