/**
 * Camera2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, makeFloatTupleRegex } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const ANCHOR_MODE = { 0: 'FIXED_TOP_LEFT', 1: 'DRAG_CENTER' };
const PROCESS_CALLBACK = { 0: 'PHYSICS', 1: 'IDLE' };

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific), matching
// v.vector2 and the renderer.
const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

// Godot's own CMP_EPSILON (core/math/math_defs.h), the threshold
// Math::is_zero_approx compares against. Matches the constant already used in
// resources/curves/curve/sample.ts for the same engine check.
const CMP_EPSILON = 0.00001;

// camera_2d.cpp:102-105: set_zoom only ERR_FAIL_COND_MSGs on
// `Math::is_zero_approx(x) || Math::is_zero_approx(y)`, whose own message says
// "Zoom level must be different from 0 (can be negative)." Negative zoom
// flips the view and is legal; only a (near-)zero component is not.
const zoomValidator: PropertyValidator = (key, value, line) => {
  const match = value.match(VECTOR2_REGEX);
  if (!match || !match[1] || !match[2]) {
    return propertyError(key, line, `Property 'zoom' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`, 'INVALID_ZOOM_FORMAT');
  }

  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);

  if (Math.abs(x) < CMP_EPSILON || Math.abs(y) < CMP_EPSILON) {
    return propertyError(key, line, `Property 'zoom' components must be non-zero (got Vector2(${x}, ${y})). Godot allows negative zoom (it flips the view); only a (near-)zero component is invalid.`, 'INVALID_ZOOM_VALUE');
  }
  return null;
};

validatorRegistry.registerAll('Camera2D', {
  // camera_2d.cpp:961, ENUM "Fixed Top Left,Drag Center" (2 labels, matches
  // BIND_ENUM_CONSTANT x2). set_anchor_mode (camera_2d.cpp:469-476) assigns
  // unconditionally, no ERR_FAIL_INDEX.
  anchor_mode: v.enumInt('anchor_mode', 0, 1, ANCHOR_MODE, { hinted: 'camera_2d.cpp:961' }),
  enabled: v.boolean('enabled'),
  ignore_rotation: v.boolean('ignore_rotation'),
  offset: v.vector2('offset'),
  zoom: zoomValidator,
  // camera_2d.cpp:966, ENUM "Physics,Idle" (2 labels, matches BIND_ENUM_CONSTANT
  // x2). set_process_callback (camera_2d.cpp:513-519) assigns unconditionally,
  // no ERR_FAIL_INDEX.
  process_callback: v.enumInt('process_callback', 0, 1, PROCESS_CALLBACK, { hinted: 'camera_2d.cpp:966' }),
  limit_left: v.lenientInt('limit_left'),
  limit_top: v.lenientInt('limit_top'),
  limit_right: v.lenientInt('limit_right'),
  limit_bottom: v.lenientInt('limit_bottom'),
  limit_smoothed: v.boolean('limit_smoothed'),
  limit_enabled: v.boolean('limit_enabled'),
  position_smoothing_enabled: v.boolean('position_smoothing_enabled'),
  // camera_2d.cpp:978 carries no numeric hint (only "suffix:px/s"). set_position_
  // smoothing_speed (camera_2d.cpp:699-706) does `position_smoothing_speed =
  // MAX(0, p_speed)`, a clamp that makes 0 legal (it disables smoothing) —
  // `positiveFloat` rejected 0, which Godot accepts.
  position_smoothing_speed: v.nonNegativeFloat('position_smoothing_speed', { enforced: 'camera_2d.cpp:703' }),
  rotation_smoothing_enabled: v.boolean('rotation_smoothing_enabled'),
  // camera_2d.cpp:982 carries no hint at all. set_rotation_smoothing_speed
  // (camera_2d.cpp:711-718) clamps the same way: `MAX(0, p_speed)`.
  rotation_smoothing_speed: v.nonNegativeFloat('rotation_smoothing_speed', { enforced: 'camera_2d.cpp:715' }),
  drag_horizontal_enabled: v.boolean('drag_horizontal_enabled'),
  drag_vertical_enabled: v.boolean('drag_vertical_enabled'),
  // camera_2d.cpp:987, "-1,1,0.01" hard both ends. set_drag_horizontal_offset
  // (camera_2d.cpp:781-789) assigns unconditionally, no clamp.
  drag_horizontal_offset: v.float('drag_horizontal_offset', { min: -1, max: 1, hinted: 'camera_2d.cpp:987' }),
  // camera_2d.cpp:988, same shape. set_drag_vertical_offset (camera_2d.cpp:766-774)
  // assigns unconditionally.
  drag_vertical_offset: v.float('drag_vertical_offset', { min: -1, max: 1, hinted: 'camera_2d.cpp:988' }),
  // camera_2d.cpp:989-992, "0,1,0.01" hard both ends on all four margins.
  // set_drag_margin (camera_2d.cpp:648-654) only ERR_FAIL_INDEXes the Side
  // enum; the margin value itself is assigned unconditionally.
  drag_left_margin: v.float('drag_left_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:989' }),
  drag_top_margin: v.float('drag_top_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:990' }),
  drag_right_margin: v.float('drag_right_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:991' }),
  drag_bottom_margin: v.float('drag_bottom_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:992' }),
  editor_draw_screen: v.boolean('editor_draw_screen'),
  editor_draw_limits: v.boolean('editor_draw_limits'),
  editor_draw_drag_margin: v.boolean('editor_draw_drag_margin'),
});

// Shown in the generated `## Linting` table of this node's sheet.
zoomValidator.accepts = 'Vector2(x, y), neither component (near-)zero';
