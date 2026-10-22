/** What more than one VisibleOnScreen slice reads: the enable mode of both Enablers and the 3D notifier box. */

import { enumNamesByValue } from '../classdb/enumNames.js';
import type { Aabb } from '../math/aabb.js';

/**
 * `VisibleOnScreenEnabler2D::EnableMode` and `VisibleOnScreenEnabler3D::EnableMode`,
 * two C++ enums with identical constants (`visible_on_screen_notifier_2d.h:85-89`,
 * `visible_on_screen_notifier_3d.h:65-69`) in the hint order "Inherit,Always,When Paused".
 * Each setter bare-assigns.
 */
const EnableMode = {
  ENABLE_MODE_INHERIT: 0,
  ENABLE_MODE_ALWAYS: 1,
  ENABLE_MODE_WHEN_PAUSED: 2,
} as const;

export const ENABLE_MODE_NAMES = enumNamesByValue(EnableMode);

/**
 * `VisibleOnScreenNotifier3D`'s `aabb` before a scene sets one (`visible_on_screen_notifier_3d.h:38`).
 * The setter stores any other box bare (`visible_on_screen_notifier_3d.cpp:52-61`).
 */
export const VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB: Aabb = Object.freeze({
  position: Object.freeze({ x: -1, y: -1, z: -1 }),
  size: Object.freeze({ x: 2, y: 2, z: 2 }),
});
