/** The enable mode both VisibleOnScreenEnablers share. */

/**
 * `VisibleOnScreenEnabler2D::EnableMode` and `VisibleOnScreenEnabler3D::EnableMode`,
 * two C++ enums with identical constants (`visible_on_screen_notifier_2d.h:85-89`,
 * `visible_on_screen_notifier_3d.h:65-69`) in the hint order "Inherit,Always,When Paused".
 * Each setter bare-assigns.
 */
export const ENABLE_MODE = {
  0: 'ENABLE_MODE_INHERIT',
  1: 'ENABLE_MODE_ALWAYS',
  2: 'ENABLE_MODE_WHEN_PAUSED',
} as const;
