/** SpinBox parser: Control and Range bases plus SpinBox's own properties (`spin_box.cpp:673-680`). */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import { parseRange } from '../shared/range';
import type { SpinBoxProperties } from './types';

/** `unquoteString` on a present value, `undefined` on an absent one. */
function optionalString(value: string | undefined): string | undefined {
  return value === undefined ? undefined : unquoteString(value);
}

export function parseSpinBox(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpinBoxProperties {
  return {
    ...parseControl(heading, properties),
    // SpinBox sets `step = 1.0` in its constructor (`ClassDB.class_get_property_default_value`,
    // 4.6.3), so a SpinBox without the key still snaps.
    ...parseRange(properties, { step: 1 }),
    alignment: parseOptionalInt(properties.alignment),
    editable: parseOptionalBool(properties.editable),
    updateOnTextChanged: parseOptionalBool(properties.update_on_text_changed),
    prefix: optionalString(properties.prefix),
    suffix: optionalString(properties.suffix),
    customArrowStep: parseOptionalFloat(properties.custom_arrow_step),
    customArrowRound: parseOptionalBool(properties.custom_arrow_round),
    selectAllOnFocus: parseOptionalBool(properties.select_all_on_focus),
  };
}
