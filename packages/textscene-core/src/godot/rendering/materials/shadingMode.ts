/** Where a BaseMaterial3D evaluates its lighting. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::ShadingMode` (`scene/resources/material.h:203-207`), without `SHADING_MODE_MAX`,
 * as the integers a `.tscn` stores for `shading_mode`. The default is PER_PIXEL (`material.h:571`).
 */
export enum ShadingMode {
  UNSHADED = 0,
  PER_PIXEL = 1,
  PER_VERTEX = 2,
}

export const SHADING_MODE_NAMES = enumNamesByValue(ShadingMode);
