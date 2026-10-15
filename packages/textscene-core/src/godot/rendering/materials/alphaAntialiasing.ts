/** How a BaseMaterial3D, a Label3D or a Sprite3D antialiases its alpha edge. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::AlphaAntiAliasing` (scene/resources/material.h:196-200), which
 * `Label3D` and `SpriteBase3D` both re-bind and forward to their own
 * StandardMaterial3D. `GeometryInstance3D`, their common ancestor, lacks it.
 */
export enum AlphaAntiAliasing {
  OFF = 0,
  ALPHA_TO_COVERAGE = 1,
  ALPHA_TO_COVERAGE_AND_TO_ONE = 2,
}

export const ALPHA_ANTIALIASING_NAMES = enumNamesByValue(AlphaAntiAliasing);
