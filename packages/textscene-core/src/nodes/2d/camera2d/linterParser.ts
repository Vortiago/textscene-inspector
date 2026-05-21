/**
 * Camera2D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const ANCHOR_MODE = { 0: 'FIXED_TOP_LEFT', 1: 'DRAG_CENTER' };
const PROCESS_CALLBACK = { 0: 'PHYSICS', 1: 'IDLE' };

const VECTOR2_REGEX =
  /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

const zoomValidator: PropertyValidator = (key, value, line) => {
  const match = value.match(VECTOR2_REGEX);
  if (!match || !match[1] || !match[2]) {
    return {
      severity: 'error',
      message: `Property 'zoom' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`,
      line,
      column: key.length + 3,
      code: 'INVALID_ZOOM_FORMAT',
    };
  }

  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);

  if (x <= 0 || y <= 0) {
    return {
      severity: 'error',
      message: `Property 'zoom' components must be greater than 0 (got Vector2(${x}, ${y})). Zero or negative zoom is invalid.`,
      line,
      column: key.length + 3,
      code: 'INVALID_ZOOM_VALUE',
    };
  }
  return null;
};

validatorRegistry.registerAll('Camera2D', {
  anchor_mode: v.enumInt('anchor_mode', 0, 1, ANCHOR_MODE),
  enabled: v.boolean('enabled'),
  ignore_rotation: v.boolean('ignore_rotation'),
  offset: v.vector2('offset'),
  zoom: zoomValidator,
  process_callback: v.enumInt('process_callback', 0, 1, PROCESS_CALLBACK),
  limit_left: v.lenientInt('limit_left'),
  limit_top: v.lenientInt('limit_top'),
  limit_right: v.lenientInt('limit_right'),
  limit_bottom: v.lenientInt('limit_bottom'),
  limit_smoothed: v.boolean('limit_smoothed'),
  position_smoothing_enabled: v.boolean('position_smoothing_enabled'),
  position_smoothing_speed: v.positiveFloat('position_smoothing_speed'),
  rotation_smoothing_enabled: v.boolean('rotation_smoothing_enabled'),
  rotation_smoothing_speed: v.positiveFloat('rotation_smoothing_speed'),
  drag_horizontal_enabled: v.boolean('drag_horizontal_enabled'),
  drag_vertical_enabled: v.boolean('drag_vertical_enabled'),
  drag_horizontal_offset: v.float('drag_horizontal_offset', { min: -1, max: 1 }),
  drag_vertical_offset: v.float('drag_vertical_offset', { min: -1, max: 1 }),
  drag_left_margin: v.float('drag_left_margin', { min: 0, max: 1 }),
  drag_top_margin: v.float('drag_top_margin', { min: 0, max: 1 }),
  drag_right_margin: v.float('drag_right_margin', { min: 0, max: 1 }),
  drag_bottom_margin: v.float('drag_bottom_margin', { min: 0, max: 1 }),
  editor_draw_screen: v.boolean('editor_draw_screen'),
  editor_draw_limits: v.boolean('editor_draw_limits'),
  editor_draw_drag_margin: v.boolean('editor_draw_drag_margin'),
});
