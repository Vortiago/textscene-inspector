/** Parses a ProgressBar: the Control and Range bases plus its own four members. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import { parseRange } from '../shared/range';
import type { ProgressBarProperties } from './types';

export function parseProgressBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): ProgressBarProperties {
  return {
    ...parseControl(heading, properties),
    // ProgressBar's default `step` is 0.01, measured with
    // `ClassDB.class_get_property_default_value` (4.6.3). `_calc_value` snaps
    // `value` to it, so an omitted key is not "no snap".
    ...parseRange(properties, { step: 0.01 }),
    fillMode: parseOptionalInt(properties.fill_mode),
    showPercentage: parseOptionalBool(properties.show_percentage),
    indeterminate: parseOptionalBool(properties.indeterminate),
    editorPreviewIndeterminate: parseOptionalBool(properties.editor_preview_indeterminate),
  };
}
