/** Godot 4.6.3's BackBufferCopy and TouchScreenButton facts a scene's properties carry. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/** `BackBufferCopy::CopyMode` (`scene/2d/back_buffer_copy.h:39-43`). */
const CopyMode = {
  DISABLED: 0,
  RECT: 1,
  VIEWPORT: 2,
} as const;

/** Each copy mode by its integer, as `back_buffer_copy.cpp:98` hints it. */
export const BACK_BUFFER_COPY_MODE_NAMES = relabelEnumNames(enumNamesByValue(CopyMode), pascalCaseLabel);

/**
 * `TouchScreenButton::VisibilityMode` (`scene/2d/physics/touch_screen_button.h:42-45`), whose
 * members carry a `VISIBILITY_` prefix.
 */
const VisibilityMode = {
  ALWAYS: 0,
  TOUCHSCREEN_ONLY: 1,
} as const;

/** Each visibility mode by its integer, spelled as its constant (`touch_screen_button.cpp:442` is the hint site). */
export const TOUCH_SCREEN_BUTTON_VISIBILITY_MODE_NAMES = enumNamesByValue(VisibilityMode);
