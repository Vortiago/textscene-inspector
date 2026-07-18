/**
 * Shared BoxContainer base for the HBox/VBox slices (the `lights/shared/`
 * pattern for a slice family). `alignment` is a property of Godot's
 * BoxContainer base class, so its type, parsing, and CSS mapping live ONCE
 * here — the two slices keep only their own wiring and axis. Pure `.ts`
 * (no React/THREE) so both parsers can import it inside the linter graph.
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

/** AlignmentMode → main-axis packing; absent/out-of-range = BEGIN (Godot default). */
export function alignmentJustify(
  alignment: number | undefined
): 'flex-start' | 'center' | 'flex-end' {
  return alignment === 1 ? 'center' : alignment === 2 ? 'flex-end' : 'flex-start';
}
