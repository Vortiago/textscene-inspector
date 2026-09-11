/**
 * Shared ScrollBar base for the HScrollBar/VScrollBar slices. `ScrollBar` is
 * Godot's abstract base (`Range → ScrollBar → H/VScrollBar`,
 * `scene/register_scene_types.cpp:470` registers it via
 * `GDREGISTER_ABSTRACT_CLASS`, so it can never appear as a `.tscn` node type
 * itself — only `HScrollBar`/`VScrollBar` are catalogued
 * (`godot/nodeBaseTypes.generated.ts`)), so its own properties and their
 * parsing live ONCE here; the two slices keep only their wiring and their
 * axis. Pure `.ts` (no React/THREE) so both parsers can import it inside the
 * linter graph — the native painter's geometry lives in
 * `shared/scrollBarSolver.ts`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalFloat } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';
import { parseRange, type RangeProperties } from './range';

export interface ScrollBarProperties extends ControlProperties, RangeProperties {
  /**
   * `custom_step` (`scroll_bar.cpp:684`) — the increment a keyboard/wheel/
   * drag nudge applies. Interaction only: no `scroll_bar.cpp` draw formula
   * reads it, so it never affects a static render.
   */
  customStep?: number;
}

/** Control + Range bases plus ScrollBar's own `custom_step`. */
export function parseScrollBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): ScrollBarProperties {
  return {
    ...parseControl(heading, properties),
    ...parseRange(properties),
    customStep: parseOptionalFloat(properties.custom_step),
  };
}
