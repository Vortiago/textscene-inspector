/** The alpha cut Label3D and Sprite3D share. */

/**
 * The alpha-cut mode `Label3D` and `SpriteBase3D` each declare, two enums that
 * agree (`label_3d.h:50-56`, `sprite_3d.h:52-58`); `material.h` has no `AlphaCutMode`.
 * Both setters enforce `ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX)` at
 * `label_3d.cpp:1013` and `sprite_3d.cpp:531`.
 */
export const LABEL_SPRITE_ALPHA_CUT = {
  0: 'DISABLED',
  1: 'DISCARD',
  2: 'OPAQUE_PREPASS',
  3: 'HASH',
} as const;
