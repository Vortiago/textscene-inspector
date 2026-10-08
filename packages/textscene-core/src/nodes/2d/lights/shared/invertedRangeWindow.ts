/**
 * The inverted range window both Light2D rules report. Godot tests each window inclusively
 * (`renderer_canvas_render_rd.cpp:2366`, `renderer_viewport.cpp:672`) and Light2D's setters only
 * assign, so `min > max` reaches nothing but still costs its pass.
 */

import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { LIGHT_2D_RANGE_DEFAULTS } from './types.js';

interface RangeWindow {
  readonly min: string;
  readonly max: string;
  readonly minDefault: number;
  readonly maxDefault: number;
  /** What an inverted window leaves the light reaching. */
  readonly reaches: string;
}

export const Z_WINDOW: RangeWindow = {
  min: 'range_z_min',
  max: 'range_z_max',
  minDefault: LIGHT_2D_RANGE_DEFAULTS.zMin,
  maxDefault: LIGHT_2D_RANGE_DEFAULTS.zMax,
  reaches: 'no item at any z_index',
};

export const LAYER_WINDOW: RangeWindow = {
  min: 'range_layer_min',
  max: 'range_layer_max',
  minDefault: LIGHT_2D_RANGE_DEFAULTS.layerMin,
  maxDefault: LIGHT_2D_RANGE_DEFAULTS.layerMax,
  reaches: 'no canvas at any layer',
};

/**
 * The message for `window` on a `typeName` node when it is inverted, or null when it is not or a
 * bound is malformed, which the validators already report. An absent half takes Godot's default
 * (`light_2d.h:61-64`):
 * `range_z_max = -2000` alone is already empty against the default `range_z_min` of -1024.
 */
export function invertedRangeWindowMessage(
  typeName: string,
  props: Record<string, string>,
  window: RangeWindow
): string | null {
  const min = ruleInt(props[window.min], window.minDefault);
  const max = ruleInt(props[window.max], window.maxDefault);
  if (min === null || max === null || min <= max) return null;
  return (
    `${typeName} '${window.min}' (${min}) is above '${window.max}' (${max}). ` +
    `Godot tests the window inclusively and does not swap the bounds, so this ` +
    `light reaches ${window.reaches}.`
  );
}
