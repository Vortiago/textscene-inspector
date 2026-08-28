/**
 * Shared Slider base for the HSlider/VSlider slices. `Slider` is Godot's
 * abstract base (Range → Slider → H/VSlider), so its own properties and their
 * parsing live ONCE here; the two slices keep only their wiring and their axis.
 * Pure `.ts` (no React/THREE) so both parsers can import it inside the linter
 * graph — the CSS mapping lives in `r3f/controls/sliderChrome.ts`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';
import { parseRange, type RangeProperties } from './range';

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
/**
 * The most tick marks this previewer will place.
 *
 * `Slider::set_ticks` has no guard at all (slider.cpp:386-393), so `tick_count`
 * is an unbounded INT slot and `2000000000` is a legal file the linter passes.
 * One index per tick hangs or OOMs the webview and the VS Code preview.
 *
 * A slider is at most a few hundred CSS pixels wide here, so past this every
 * additional mark lands sub-pixel on top of another and changes no rendered
 * image. This is a limit of the previewer, not a claim about Godot.
 */
const MAX_RENDERED_TICKS = 1024;

export function sliderTickIndices(props: SliderProperties): number[] {
  const ticks = Math.min(props.tickCount ?? SLIDER_DEFAULT_TICK_COUNT, MAX_RENDERED_TICKS);
  if (ticks <= 1) return [];
  const onBorders = props.ticksOnBorders ?? false;
  const indices: number[] = [];
  for (let i = 0; i < ticks; i++) {
    if (!onBorders && (i === 0 || i + 1 === ticks)) continue;
    indices.push(i);
  }
  return indices;
}
