/** Control's own enums, as the engine declares them. */

/**
 * `Control::CURSOR_ARROW` (`scene/gui/control.h:101`), the first
 * `CursorShape` and the field's initial value (`control.h:245`).
 *
 * Exported on its own because the second reader asks only whether the shape is
 * still this one: SubViewportContainer's configuration warning tests
 * `get_default_cursor_shape() != Control::CURSOR_ARROW`
 * (`subviewport_container.cpp:283`), which is a different question from the
 * range {@link CURSOR_SHAPES} bounds, over the same enum.
 */
export const CURSOR_ARROW = 0;

/**
 * `CURSOR_MAX` (`control.h:118`), the count sentinel — not a shape.
 *
 * `set_default_cursor_shape` opens with `ERR_FAIL_INDEX(int(p_shape),
 * CURSOR_MAX)` (`control.cpp:2877`), so the legal span is 0..16 and the labels
 * below stop at HELP.
 *
 * The two readings must agree on this number or they contradict each other on a
 * single scene: Control's validator ERRORS above it, and SubViewportContainer's
 * rule warns only BELOW it, so a sentinel that is too wide puts a warning beside
 * that error and one that is too narrow goes silent on a legal shape.
 */
export const CURSOR_MAX = 17;

/**
 * The shape names Godot binds (`BIND_ENUM_CONSTANT`, `control.cpp:4347-4363`),
 * for a diagnostic that reports which values are legal. One entry per shape, so
 * the list length IS {@link CURSOR_MAX}.
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
