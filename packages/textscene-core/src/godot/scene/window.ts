/** Godot 4.6.3's Window facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';
import { findInClassChain } from '../classdb/classBaseTypes.js';
import type { Vector2 } from '../math/vector.js';

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
export const InitialPosition = {
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
export const ContentScaleStretch = {
  FRACTIONAL: 0,
  INTEGER: 1,
} as const;

export const WINDOW_MODE_NAMES = enumNamesByValue(Mode);
export const WINDOW_INITIAL_POSITION_NAMES = enumNamesByValue(InitialPosition);
export const WINDOW_CONTENT_SCALE_MODE_NAMES = enumNamesByValue(ContentScaleMode);
export const WINDOW_CONTENT_SCALE_ASPECT_NAMES = enumNamesByValue(ContentScaleAspect);
export const WINDOW_CONTENT_SCALE_STRETCH_NAMES = enumNamesByValue(ContentScaleStretch);

/** The flags a Window class's constructor sets, which a scene line overrides. */
interface WindowClassDefaults {
  visible: boolean;
  wrapControls: boolean;
  borderless: boolean;
  transparent: boolean;
}

/** `window.h:126-140`: a Window starts visible, decorated and opaque. */
const WINDOW_DEFAULTS: WindowClassDefaults = {
  visible: true,
  wrapControls: false,
  borderless: false,
  transparent: false,
};

/**
 * Each constructor's own flags, keyed by the class that sets them: `Popup::Popup()`
 * (`popup.cpp:215-225`) and `PopupPanel::PopupPanel()` (`popup.cpp:430`).
 */
const CLASS_DEFAULTS: Readonly<Record<string, WindowClassDefaults>> = {
  Window: WINDOW_DEFAULTS,
  Popup: { visible: false, wrapControls: true, borderless: true, transparent: false },
  PopupPanel: { visible: false, wrapControls: true, borderless: true, transparent: true },
};

/** The defaults of `type`, from the nearest class in its chain that sets its own. */
export function windowClassDefaults(type: string): WindowClassDefaults {
  return findInClassChain(type, (className) => CLASS_DEFAULTS[className]) ?? WINDOW_DEFAULTS;
}

/** `window.h:105,126`: `size = Size2i(DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_SIZE)`. */
const DEFAULT_WINDOW_SIZE: Vector2 = { x: 100, y: 100 };

/** One write of a size line, in file order. */
export interface WindowSizeWrite {
  key: 'size' | 'min_size' | 'max_size';
  value: Vector2;
}

const SIZE_KEYS: ReadonlySet<string> = new Set<WindowSizeWrite['key']>(['size', 'min_size', 'max_size']);

/** Whether a property key is one of the size lines `replayWindowSize` applies. */
export function isWindowSizeKey(key: string): key is WindowSizeWrite['key'] {
  return SIZE_KEYS.has(key);
}

/** The limits that clamp a window's size. A `maxSize` of `(0, 0)` sets no maximum. */
interface WindowSizeLimits {
  minSize: Vector2;
  maxSize: Vector2;
}

const ZERO_SIZE: Vector2 = { x: 0, y: 0 };

/** `_clamp_limit_size` (`window.cpp:461-469`): a limit floors each axis at 0. */
export function clampLimitSize(size: Vector2): Vector2 {
  return { x: Math.max(size.x, 0), y: Math.max(size.y, 0) };
}

/**
 * `max_size` while `_validate_limit_size` (`window.cpp:471-475`) accepts it, else `null`. A `null`
 * cap is the rendering server's maximum, which a target size meets on its own.
 */
export function validMaxSize({ minSize, maxSize }: WindowSizeLimits): Vector2 | null {
  if (maxSize.x <= 0 && maxSize.y <= 0) return null;
  return maxSize.x >= minSize.x && maxSize.y >= minSize.y ? maxSize : null;
}

/** `_update_window_size`'s clamp (`window.cpp:1183-1196`): the floor, then a valid cap. */
function clampWindowSize(size: Vector2, floor: Vector2, limits: WindowSizeLimits): Vector2 {
  const floored = { x: Math.max(size.x, floor.x), y: Math.max(size.y, floor.y) };
  const cap = validMaxSize(limits);
  return cap ? { x: Math.min(floored.x, cap.x), y: Math.min(floored.y, cap.y) } : floored;
}

/**
 * The size a window holds after its scene lines load, applied in file order. Each setter runs
 * `_update_window_size` (`window.cpp:1183-1229`), so an early cap stands under a later floor.
 * `set_min_size` and `set_max_size` (`window.cpp:477-515`) floor the limit at 0 first.
 */
export function replayWindowSize(writes: Iterable<WindowSizeWrite>): Vector2 {
  let size = DEFAULT_WINDOW_SIZE;
  const limits: WindowSizeLimits = { minSize: ZERO_SIZE, maxSize: ZERO_SIZE };
  for (const { key, value } of writes) {
    if (key === 'size') size = value;
    else if (key === 'min_size') limits.minSize = clampLimitSize(value);
    else limits.maxSize = clampLimitSize(value);
    size = clampWindowSize(size, limits.minSize, limits);
  }
  return size;
}

/** What an embedded window's final size reads beside its loaded size. */
interface EmbeddedWindowSizing extends WindowSizeLimits {
  wrapControls: boolean;
}

/**
 * `_update_window_size` once the window's Controls are ready (`window.cpp:1629-1632`): with
 * `wrap_controls` the floor is `min_size` or the contents minimum, whichever is larger
 * (`get_clamped_minimum_size`, `window.cpp:2244-2251`). An embedded window keeps 1 pixel at
 * least (`window.cpp:1208`).
 */
export function embeddedWindowSize(
  loaded: Vector2,
  sizing: EmbeddedWindowSizing,
  contentsMinimum: Vector2
): Vector2 {
  const { minSize, wrapControls } = sizing;
  const floor = wrapControls
    ? { x: Math.max(minSize.x, contentsMinimum.x), y: Math.max(minSize.y, contentsMinimum.y) }
    : minSize;
  const size = clampWindowSize(loaded, floor, sizing);
  return { x: Math.max(size.x, 1), y: Math.max(size.y, 1) };
}

/**
 * `(embedder->get_visible_rect().size - size) / 2` (`window.cpp:1555-1560`) for any
 * `initial_position` but Absolute. It reads the size before the Controls wrap it, and `Vector2i`
 * division truncates toward zero.
 */
export function centredWindowPosition(embedderSize: Vector2, size: Vector2): Vector2 {
  return { x: halfOfInt(embedderSize.x - size.x), y: halfOfInt(embedderSize.y - size.y) };
}

/** C++ `int / 2`: truncated toward zero, and never a negative zero. */
export function halfOfInt(value: number): number {
  return Math.trunc(value / 2) || 0;
}
