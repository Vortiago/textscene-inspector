/** The enable mode both VisibleOnScreenEnablers share. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `VisibleOnScreenEnabler2D::EnableMode` and `VisibleOnScreenEnabler3D::EnableMode`,
 * two C++ enums with identical constants (`visible_on_screen_notifier_2d.h:85-89`,
 * `visible_on_screen_notifier_3d.h:65-69`) in the hint order "Inherit,Always,When Paused".
 * Each setter bare-assigns.
 */
enum EnableMode {
  ENABLE_MODE_INHERIT = 0,
  ENABLE_MODE_ALWAYS = 1,
  ENABLE_MODE_WHEN_PAUSED = 2,
}

export const ENABLE_MODE_NAMES = enumNamesByValue(EnableMode);
