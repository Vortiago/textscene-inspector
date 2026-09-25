/** FoldableContainer parser: the Control parse plus the five properties that change the drawing. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { boolSlotValue } from '../../../../godot/index.js';
import { parseControl } from '../control/parser';
import type { FoldableContainerProperties } from './types';

export function parseFoldableContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): FoldableContainerProperties {
  const result: FoldableContainerProperties = { ...parseControl(heading, properties) };
  result.folded = boolSlotValue(properties.folded) === true;
  if (properties.title !== undefined) result.title = unquoteString(properties.title);
  result.titleAlignment = parseOptionalInt(properties.title_alignment);
  result.titlePosition = parseOptionalInt(properties.title_position);
  result.titleTextOverrunBehavior = parseOptionalInt(properties.title_text_overrun_behavior);
  return result;
}
