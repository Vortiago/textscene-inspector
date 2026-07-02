/**
 * AudioStreamPlayer parser — parses 8 properties from the linter's
 * authoritative surface plus inherited Node base.
 *
 * Godot defaults follow the engine's @export var declarations. The
 * parser tolerates missing values (uses defaults) and malformed numbers
 * (logs a warn through the shared logger and falls back to default).
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
