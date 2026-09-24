/**
 * Shared BoxContainer base for the HBox/VBox slices: `alignment` belongs to Godot's BoxContainer, so
 * its type and parse live here, in pure `.ts` for the linter graph.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export interface BoxContainerProperties extends ControlProperties {
  /** BoxContainer AlignmentMode: 0=BEGIN, 1=CENTER, 2=END (Godot default 0). */
  alignment?: number;
}

/** Control base plus BoxContainer's `alignment` (main-axis packing). */
export function parseBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoxContainerProperties {
  const result: BoxContainerProperties = { ...parseControl(heading, properties) };
  result.alignment = parseOptionalInt(properties.alignment);
  return result;
}
