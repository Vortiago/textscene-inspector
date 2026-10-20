/** Godot 4.6.3's Window facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `Window::Mode` without `MODE_`, each member the `DisplayServer::WindowMode` it aliases
 * (`scene/main/window.h:48-54`, 4.7.2 `:47-53`; `servers/display/display_server.h:63-69`, 4.7.2
 * `display_server_enums.h:196-202`).
 */
const Mode = {
  WINDOWED: 0,
  MINIMIZED: 1,
  MAXIMIZED: 2,
  FULLSCREEN: 3,
  EXCLUSIVE_FULLSCREEN: 4,
} as const;

/** `Window::WindowInitialPosition` without `WINDOW_INITIAL_POSITION_` (`window.h:109-116`, 4.7.2 `:108-115`). */
const InitialPosition = {
  ABSOLUTE: 0,
  CENTER_PRIMARY_SCREEN: 1,
  CENTER_MAIN_WINDOW_SCREEN: 2,
  CENTER_OTHER_SCREEN: 3,
  CENTER_SCREEN_WITH_MOUSE_FOCUS: 4,
  CENTER_SCREEN_WITH_KEYBOARD_FOCUS: 5,
} as const;

/** `Window::ContentScaleMode` without `CONTENT_SCALE_MODE_` (`window.h:73-77`, 4.7.2 `:72-76`). */
const ContentScaleMode = {
  DISABLED: 0,
  CANVAS_ITEMS: 1,
  VIEWPORT: 2,
} as const;

/** `Window::ContentScaleAspect` without `CONTENT_SCALE_ASPECT_` (`window.h:79-85`, 4.7.2 `:78-84`). */
const ContentScaleAspect = {
  IGNORE: 0,
  KEEP: 1,
  KEEP_WIDTH: 2,
  KEEP_HEIGHT: 3,
  EXPAND: 4,
} as const;

/** `Window::ContentScaleStretch` without `CONTENT_SCALE_STRETCH_` (`window.h:87-90`, 4.7.2 `:86-89`). */
const ContentScaleStretch = {
  FRACTIONAL: 0,
  INTEGER: 1,
} as const;

export const WINDOW_MODE_NAMES = enumNamesByValue(Mode);
export const WINDOW_INITIAL_POSITION_NAMES = enumNamesByValue(InitialPosition);
export const WINDOW_CONTENT_SCALE_MODE_NAMES = enumNamesByValue(ContentScaleMode);
export const WINDOW_CONTENT_SCALE_ASPECT_NAMES = enumNamesByValue(ContentScaleAspect);
export const WINDOW_CONTENT_SCALE_STRETCH_NAMES = enumNamesByValue(ContentScaleStretch);
