/**
 * Shared Slider base for the HSlider/VSlider slices. `Slider` is Godot's
 * abstract base (Range → Slider → H/VSlider), so its own properties and their
 * parsing live ONCE here; the two slices keep only their wiring and their axis.
 * Pure `.ts` (no React/THREE) so both parsers can import it inside the linter
 * graph — the native painter's geometry lives in `shared/sliderSolver.ts`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';
import { parseRange, type RangeProperties } from './range';
import { MAX_WALKED_ELEMENTS } from './countWalk';

export interface SliderProperties extends ControlProperties, RangeProperties {
  /**
   * `tick_count`: how many tick marks to space across the travel. Godot draws
   * them only `if (ticks > 1)`; the default is 0, so an unset `tick_count`
   * draws none whatever `ticks_on_borders` says.
   */
  tickCount?: number;
  /** Draw the first and last tick too. Godot default false. */
  ticksOnBorders?: boolean;
  /** Godot default true; a non-editable slider wears the disabled grabber. */
  editable?: boolean;
}

/** Godot `Slider` property defaults (doc/classes/Slider.xml). */
export const SLIDER_DEFAULT_TICK_COUNT = 0;
export const SLIDER_DEFAULT_EDITABLE = true;

/** Control + Range bases plus Slider's own tick/editable properties. */
export function parseSlider(
  heading: ParsedHeading,
  properties: Record<string, string>
): SliderProperties {
  return {
    ...parseControl(heading, properties),
    ...parseRange(properties),
    tickCount: parseOptionalInt(properties.tick_count),
    ticksOnBorders: parseOptionalBool(properties.ticks_on_borders),
    editable: parseOptionalBool(properties.editable),
  };
}

/**
 * The tick indices Godot actually paints, from
 * `Slider::_notification(NOTIFICATION_DRAW)`:
 *
 *     if (ticks > 1) {
 *       for (int i = 0; i < ticks; i++) {
 *         if (!ticks_on_borders && (i == 0 || i + 1 == ticks)) { continue; }
 *
 * so `tick_count <= 1` paints nothing at all, and the borders are skipped
 * unless `ticks_on_borders` is set.
 */
export function sliderTickIndices(props: SliderProperties): number[] {
  // `tick_count` is an unbounded INT slot, and a slider is at most a few
  // hundred CSS pixels wide here (countWalk.ts).
  const ticks = Math.min(props.tickCount ?? SLIDER_DEFAULT_TICK_COUNT, MAX_WALKED_ELEMENTS);
  if (ticks <= 1) return [];
  const onBorders = props.ticksOnBorders ?? false;
  const indices: number[] = [];
  for (let i = 0; i < ticks; i++) {
    if (!onBorders && (i === 0 || i + 1 === ticks)) continue;
    indices.push(i);
  }
  return indices;
}
