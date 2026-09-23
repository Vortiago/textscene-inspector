/** Control's own enums, as the engine declares them. */

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

/** `Control::LayoutDirection` (`scene/gui/control.h:155-160`). */
export const LAYOUT_DIRECTION_INHERITED = 0;
export const LAYOUT_DIRECTION_APPLICATION_LOCALE = 1;
export const LAYOUT_DIRECTION_LTR = 2;
export const LAYOUT_DIRECTION_RTL = 3;
export const LAYOUT_DIRECTION_SYSTEM_LOCALE = 4;
/** The count sentinel `set_layout_direction`'s `ERR_FAIL_INDEX` bounds against (`control.cpp:3539`). */
export const LAYOUT_DIRECTION_MAX = 5;

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
    case LAYOUT_DIRECTION_APPLICATION_LOCALE:
      return env.forceRtl || env.applicationLocaleRtl;
    case LAYOUT_DIRECTION_SYSTEM_LOCALE:
      return env.forceRtl || env.systemLocaleRtl;
    case LAYOUT_DIRECTION_LTR:
      return false;
    case LAYOUT_DIRECTION_RTL:
      return true;
    default:
      // INHERITED, and every value the setter's ERR_FAIL_INDEX refused. No
      // {@link LayoutDirectionEnv.forceRtl}: its force check needs `is_editor_hint()`
      // (`scene/main/node.cpp:2752-2755`), false for a loaded scene.
      return inherited ?? env.rootRtl;
  }
}
