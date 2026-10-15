/** The space override Area2D and Area3D share. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `Area2D.SpaceOverride` and `Area3D.SpaceOverride`, enforced separately by
 * each class: `area_2d.cpp:653` and `area_3d.cpp:778`.
 */
export enum SpaceOverride {
  DISABLED = 0,
  COMBINE = 1,
  COMBINE_REPLACE = 2,
  REPLACE = 3,
  REPLACE_COMBINE = 4,
}

export const SPACE_OVERRIDE_NAMES = enumNamesByValue(SpaceOverride);
