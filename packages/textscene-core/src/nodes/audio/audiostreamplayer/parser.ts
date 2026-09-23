/**
 * AudioStreamPlayer parser for the linter's property surface plus the inherited Node base. A
 * missing value takes Godot's default, and a malformed number logs a warning and falls back to it.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';
import { parseAudioBase } from '../parseAudioBase';
import type { AudioStreamPlayerProperties } from './types';

export function parseAudioStreamPlayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): AudioStreamPlayerProperties {
  const baseProps = parseNode(heading, properties);

  return {
    ...baseProps,
    ...parseAudioBase(properties, 'AudioStreamPlayer'),
  };
}
