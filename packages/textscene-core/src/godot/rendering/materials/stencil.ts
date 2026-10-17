/** A BaseMaterial3D's stencil buffer settings. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::StencilMode` (`scene/resources/material.h:331-337`), as the integers a `.tscn`
 * stores for `stencil_mode`. The default is DISABLED (`material.h:622`).
 */
enum StencilMode {
  DISABLED = 0,
  OUTLINE = 1,
  XRAY = 2,
  CUSTOM = 3,
}

export const STENCIL_MODE_NAMES = enumNamesByValue(StencilMode);

/**
 * `BaseMaterial3D::StencilFlags` (`scene/resources/material.h:339-344`), the bits of `stencil_flags`
 * without `STENCIL_FLAG_NUM_BITS`. A material stores no flag by default (`material.h:623`).
 */
export enum StencilFlag {
  READ = 1,
  WRITE = 2,
  WRITE_DEPTH_FAIL = 4,
}

/** Each flag's name by its bit, as the inspector hint lists them (`material.cpp:3776`). */
export const STENCIL_FLAG_LABELS = enumNamesByValue(StencilFlag);

/**
 * `BaseMaterial3D::StencilCompare` (`scene/resources/material.h:347-355`), as the integers a
 * `.tscn` stores for `stencil_compare`. The default is ALWAYS (`material.h:624`).
 */
enum StencilCompare {
  ALWAYS = 0,
  LESS = 1,
  EQUAL = 2,
  LESS_OR_EQUAL = 3,
  GREATER = 4,
  NOT_EQUAL = 5,
  GREATER_OR_EQUAL = 6,
}

export const STENCIL_COMPARE_NAMES = enumNamesByValue(StencilCompare);
