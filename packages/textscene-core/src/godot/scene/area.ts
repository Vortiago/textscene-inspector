/** The space override Area2D and Area3D share. */

/**
 * `Area2D.SpaceOverride` and `Area3D.SpaceOverride`, enforced separately by
 * each class: `area_2d.cpp:653` and `area_3d.cpp:778`.
 */
export const SPACE_OVERRIDE = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
} as const;
