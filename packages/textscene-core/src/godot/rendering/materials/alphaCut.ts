/** The alpha cut Label3D and Sprite3D share. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * The alpha-cut mode `Label3D` and `SpriteBase3D` each declare, two enums that
 * agree (`label_3d.h:50-56`, `sprite_3d.h:52-58`); `material.h` has no `AlphaCutMode`.
 * Both setters enforce `ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX)` at
 * `label_3d.cpp:1013` and `sprite_3d.cpp:531`.
 */
export const AlphaCutMode = {
  DISABLED: 0,
  DISCARD: 1,
  OPAQUE_PREPASS: 2,
  HASH: 3,
} as const;

export const ALPHA_CUT_NAMES = enumNamesByValue(AlphaCutMode);
