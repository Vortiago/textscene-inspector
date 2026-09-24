/**
 * Shared ScrollBar base for the HScrollBar/VScrollBar slices: its properties and their parse, in
 * pure `.ts` for the linter graph. `ScrollBar` is abstract (`GDREGISTER_ABSTRACT_CLASS`,
 * `scene/register_scene_types.cpp:470`), so it is never a `.tscn` node type itself. The native
 * geometry is `shared/scrollBarSolver.ts`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalFloat } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';
import { parseRange, type RangeProperties } from './range';

export interface ScrollBarProperties extends ControlProperties, RangeProperties {
  /**
   * `custom_step` (`scroll_bar.cpp:684`): the increment a keyboard, wheel or drag nudge applies. No
   * `scroll_bar.cpp` draw formula reads it.
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
    // HScrollBar and VScrollBar both default `step` to 0.0 (`ClassDB.class_get_property_default_value`,
    // 4.6.3), which disables `_calc_value`'s snap.
    ...parseRange(properties, { step: 0 }),
    customStep: parseOptionalFloat(properties.custom_step),
  };
}
