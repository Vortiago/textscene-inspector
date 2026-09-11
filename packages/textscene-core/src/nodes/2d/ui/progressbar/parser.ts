/** ProgressBar parser — Control + Range bases plus ProgressBar's own four members. */

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
    ...parseRange(properties),
    fillMode: parseOptionalInt(properties.fill_mode),
    showPercentage: parseOptionalBool(properties.show_percentage),
    indeterminate: parseOptionalBool(properties.indeterminate),
    editorPreviewIndeterminate: parseOptionalBool(properties.editor_preview_indeterminate),
  };
}
