/** Control's own enums, as the engine declares them. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/**
 * `Control::SizeFlags` (`scene/gui/control.h:64-69`), the bits the `size_flags_*` properties store.
 * `SIZE_SHRINK_BEGIN = 0` (`control.h:79`) is the empty set and `SIZE_EXPAND_FILL = 3`
 * (`control.h:85`, `control.cpp:4390`) is `EXPAND | FILL`, so neither is a member.
 */
export enum SizeFlags {
  FILL = 1,
  EXPAND = 2,
  SHRINK_CENTER = 4,
  SHRINK_END = 8,
}

/** What both `size_flags_*` properties hold until a scene sets them (`control.h:229-230`). */
export const DEFAULT_SIZE_FLAGS = SizeFlags.FILL;

/** The labels the `size_flags_*` hints print (`control.cpp:4388-4392`). */
export const SIZE_FLAGS_LABELS = relabelEnumNames(enumNamesByValue(SizeFlags), (name) => `SIZE_${name}`);

/**
 * `Control::CURSOR_ARROW` (`scene/gui/control.h:101`), the first `CursorShape` and the field's
 * initial value (`control.h:245`). Exported alone, as SubViewportContainer's warning tests
 * `get_default_cursor_shape() != Control::CURSOR_ARROW` (`subviewport_container.cpp:283`), not the
 * range {@link CURSOR_SHAPES} bounds.
 */
export const CURSOR_ARROW = 0;

/**
 * `CURSOR_MAX` (`control.h:118`), the count sentinel. `set_default_cursor_shape` opens with
 * `ERR_FAIL_INDEX(int(p_shape), CURSOR_MAX)` (`control.cpp:2877`), so the legal span is 0..16.
 * Control's validator errors at or above it and SubViewportContainer's rule warns only below
 * it, so both read this one number.
 */
export const CURSOR_MAX = 17;

/**
 * The shape names Godot binds (`BIND_ENUM_CONSTANT`, `control.cpp:4347-4363`), for a diagnostic
 * that reports the legal values. One entry per shape, so the length is {@link CURSOR_MAX}.
 */
export const CURSOR_SHAPES = {
  0: 'ARROW',
  1: 'IBEAM',
  2: 'POINTING_HAND',
  3: 'CROSS',
  4: 'WAIT',
  5: 'BUSY',
  6: 'DRAG',
  7: 'CAN_DROP',
  8: 'FORBIDDEN',
  9: 'VSIZE',
  10: 'HSIZE',
  11: 'BDIAGSIZE',
  12: 'FDIAGSIZE',
  13: 'MOVE',
  14: 'VSPLIT',
  15: 'HSPLIT',
  16: 'HELP',
};

/** `Control::GrowDirection` (`scene/gui/control.h:59-63`), as `grow_horizontal` and `grow_vertical` store it. */
export enum GrowDirection {
  GROW_DIRECTION_BEGIN = 0,
  GROW_DIRECTION_END = 1,
  GROW_DIRECTION_BOTH = 2,
}

/** `Control::LayoutDirection` (`scene/gui/control.h:155-160`). */
export const LayoutDirection = {
  INHERITED: 0,
  APPLICATION_LOCALE: 1,
  LTR: 2,
  RTL: 3,
  SYSTEM_LOCALE: 4,
} as const;

/** The direction names Godot binds (`control.cpp:4405-4409`), for a diagnostic that reports the legal values. */
export const LAYOUT_DIRECTION_NAMES = enumNamesByValue(LayoutDirection);

/**
 * What `Control::is_layout_rtl()` reads besides the `layout_direction` chain: the project
 * settings and locale answers, each reduced to the boolean the C++ branch produces. Reduced, so
 * this module stays a leaf without the locale table and the project settings store.
 */
export interface LayoutDirectionEnv {
  /** `internationalization/rendering/force_right_to_left_layout_direction`. */
  forceRtl: boolean;
  /** What an INHERITED Control with no ancestor Control or Window resolves to (`control.cpp:3600-3608`). */
  rootRtl: boolean;
  /** `TS->is_locale_right_to_left(_get_locale())`. */
  applicationLocaleRtl: boolean;
  /** `TS->is_locale_right_to_left(OS::get_singleton()->get_locale())`. */
  systemLocaleRtl: boolean;
}

/** Godot's own defaults: force off, root direction 0, a left-to-right locale. */
export const LTR_LAYOUT_ENV: LayoutDirectionEnv = {
  forceRtl: false,
  rootRtl: false,
  applicationLocaleRtl: false,
  systemLocaleRtl: false,
};

/**
 * `Control::is_layout_rtl()` (`control.cpp:3551-3620`) after the ancestor climb: `inherited` is the
 * nearest ancestor Control or Window's answer (`control.cpp:3586-3593`), or `null` off the top. The
 * climb's translation-domain gate (`control.cpp:3584`) always holds: `translation_domain` has no
 * `ADD_PROPERTY`, so no `.tscn` sets one (`core/object/object.cpp:2026-2027`).
 */
export function resolveLayoutRtl(
  layoutDirection: number | undefined,
  inherited: boolean | null,
  env: LayoutDirectionEnv
): boolean {
  switch (layoutDirection) {
    case LayoutDirection.APPLICATION_LOCALE:
      return env.forceRtl || env.applicationLocaleRtl;
    case LayoutDirection.SYSTEM_LOCALE:
      return env.forceRtl || env.systemLocaleRtl;
    case LayoutDirection.LTR:
      return false;
    case LayoutDirection.RTL:
      return true;
    default:
      // INHERITED, and every value the setter's ERR_FAIL_INDEX refused. No
      // {@link LayoutDirectionEnv.forceRtl}: its force check needs `is_editor_hint()`
      // (`scene/main/node.cpp:2752-2755`), false for a loaded scene.
      return inherited ?? env.rootRtl;
  }
}

/** `Control::MouseFilter` (`scene/gui/control.h:88-92`). */
const MouseFilter = {
  STOP: 0,
  PASS: 1,
  IGNORE: 2,
} as const;

/** Each mouse filter by its integer, spelled as its constant without `MOUSE_FILTER_` (`control.cpp:4394-4396`). */
export const MOUSE_FILTER_NAMES = enumNamesByValue(MouseFilter);

/** `Control::FocusMode` (`control.h:65-70`). */
const FocusMode = {
  NONE: 0,
  CLICK: 1,
  ALL: 2,
  ACCESSIBILITY: 3,
} as const;

/** Each focus mode by its integer, spelled as its constant without `FOCUS_`. */
export const FOCUS_MODE_NAMES = enumNamesByValue(FocusMode);

/**
 * Each focus mode by its integer, as the hints of `control.cpp:4297`, `tab_container.cpp:1218` and
 * `graph_node.cpp:1301` print it. The last two list only part of the enum.
 */
export const FOCUS_MODE_HINT_NAMES = relabelEnumNames(FOCUS_MODE_NAMES, pascalCaseLabel);

/**
 * `Control::FocusBehaviorRecursive` (`control.h:72-76`) and `Control::MouseBehaviorRecursive`
 * (`control.h:94-98`): two C++ enums with the same members, so one table serves
 * `focus_behavior_recursive` and `mouse_behavior_recursive`.
 */
const RecursiveBehavior = {
  INHERITED: 0,
  DISABLED: 1,
  ENABLED: 2,
} as const;

/** Each recursive behaviour by its integer, spelled as its constant without its prefix. */
export const CONTROL_RECURSIVE_BEHAVIOR_NAMES = enumNamesByValue(RecursiveBehavior);

/** `DisplayServer::AccessibilityLiveMode` (`servers/display/display_server.h:657-661`). */
const AccessibilityLiveMode = {
  OFF: 0,
  POLITE: 1,
  ASSERTIVE: 2,
} as const;

/** Each accessibility live mode by its integer, spelled as its constant without `LIVE_` (`display/display_server.cpp:1768-1770`). */
export const ACCESSIBILITY_LIVE_NAMES = enumNamesByValue(AccessibilityLiveMode);
