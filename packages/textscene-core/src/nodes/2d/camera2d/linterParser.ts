/** Camera2D strict validators for linting. */

// The base chain: registration happens on import, so a test that loads only this
// slice resolves an inherited key only through this line.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { isZeroApprox } from '../../../godot/index.js';

const ANCHOR_MODE = { 0: 'FIXED_TOP_LEFT', 1: 'DRAG_CENTER' };
const PROCESS_CALLBACK = { 0: 'PHYSICS', 1: 'IDLE' };

// camera_2d.cpp:104: set_zoom refuses the whole write when either component is
// zero-approx (ERR_FAIL_COND_MSG), so the camera keeps its previous zoom.
const zoomValidator = v.vector2('zoom', {
  components: ([x, y]) =>
    isZeroApprox(x!) || isZeroApprox(y!)
      ? { message: `Property 'zoom' components must be non-zero (got Vector2(${x}, ${y})). Godot allows negative zoom (it flips the view); only a (near-)zero component is invalid.` }
      : null,
  accepts: 'Vector2(x, y), neither component (near-)zero',
  enforced: 'camera_2d.cpp:104',
});

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
  // MAX(0, p_speed)`, a clamp that makes 0 legal: it disables smoothing.
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
  // enum. The margin value itself is assigned unconditionally.
  drag_left_margin: v.float('drag_left_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:989' }),
  drag_top_margin: v.float('drag_top_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:990' }),
  drag_right_margin: v.float('drag_right_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:991' }),
  drag_bottom_margin: v.float('drag_bottom_margin', { min: 0, max: 1, hinted: 'camera_2d.cpp:992' }),
  editor_draw_screen: v.boolean('editor_draw_screen'),
  editor_draw_limits: v.boolean('editor_draw_limits'),
  editor_draw_drag_margin: v.boolean('editor_draw_drag_margin'),
});

