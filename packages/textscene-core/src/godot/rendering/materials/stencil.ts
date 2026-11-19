/** A BaseMaterial3D's stencil buffer settings. */

import { enumNamesByValue, type EnumValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::StencilMode` (`scene/resources/material.h:331-337`), as the integers a `.tscn`
 * stores for `stencil_mode`. The default is DISABLED (`material.h:622`).
 */
const StencilMode = {
  DISABLED: 0,
  OUTLINE: 1,
  XRAY: 2,
  CUSTOM: 3,
} as const;

export { StencilMode };
export const STENCIL_MODE_NAMES = enumNamesByValue(StencilMode);

/**
 * `BaseMaterial3D::StencilFlags` (`scene/resources/material.h:339-344`), the bits of `stencil_flags`
 * without `STENCIL_FLAG_NUM_BITS`. A material stores no flag by default (`material.h:623`).
 */
export const StencilFlag = {
  READ: 1,
  WRITE: 2,
  WRITE_DEPTH_FAIL: 4,
} as const;

export const WRITE_FLAGS = StencilFlag.WRITE | StencilFlag.WRITE_DEPTH_FAIL;

/**
 * The flags `set_stencil_flags` (`material.cpp:3251`) stores for `requested` over `current`.
 * @canonical Model the stencil flags Godot keeps after a set.
 */
export function stencilFlagsAfterSet(current: number, requested: number): number {
  let flags = requested;
  if (flags & StencilFlag.READ && current & WRITE_FLAGS) flags &= StencilFlag.READ;
  if (flags & WRITE_FLAGS && current & StencilFlag.READ) flags &= WRITE_FLAGS;
  if (flags & StencilFlag.READ && flags & WRITE_FLAGS) flags &= StencilFlag.READ;
  return flags;
}

/** Each flag's name by its bit, as the inspector hint lists them (`material.cpp:3776`). */
export const STENCIL_FLAG_NAMES = enumNamesByValue(StencilFlag);

/**
 * `BaseMaterial3D::StencilCompare` (`scene/resources/material.h:347-355`), as the integers a
 * `.tscn` stores for `stencil_compare`. The default is ALWAYS (`material.h:624`).
 */
const StencilCompare = {
  ALWAYS: 0,
  LESS: 1,
  EQUAL: 2,
  LESS_OR_EQUAL: 3,
  GREATER: 4,
  NOT_EQUAL: 5,
  GREATER_OR_EQUAL: 6,
} as const;

export { StencilCompare };
export const STENCIL_COMPARE_NAMES = enumNamesByValue(StencilCompare);

/** Each flag's word in a shader's `stencil_mode`, in bit order (`shader_types.cpp:256-258`). */
export const STENCIL_FLAG_WORDS: Readonly<Record<number, string>> = {
  [StencilFlag.READ]: 'read',
  [StencilFlag.WRITE]: 'write',
  [StencilFlag.WRITE_DEPTH_FAIL]: 'write_depth_fail',
};

/** Each compare's word in a shader's `stencil_mode`. */
export const STENCIL_COMPARE_WORDS: Readonly<Record<EnumValue<typeof StencilCompare>, string>> = {
  [StencilCompare.ALWAYS]: 'compare_always',
  [StencilCompare.LESS]: 'compare_less',
  [StencilCompare.EQUAL]: 'compare_equal',
  [StencilCompare.LESS_OR_EQUAL]: 'compare_less_or_equal',
  [StencilCompare.GREATER]: 'compare_greater',
  [StencilCompare.NOT_EQUAL]: 'compare_not_equal',
  [StencilCompare.GREATER_OR_EQUAL]: 'compare_greater_or_equal',
};
