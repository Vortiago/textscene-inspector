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
import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseBus } from '../parseBus';
import type { AudioStreamPlayerProperties } from './types';

export function parseAudioStreamPlayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): AudioStreamPlayerProperties {
  const baseProps = parseNode(heading, properties);

  const result: AudioStreamPlayerProperties = {
    ...baseProps,
    volume_db: floatOr(properties.volume_db, 0),
    pitch_scale: floatOr(properties.pitch_scale, 1),
    playing: boolOr(properties.playing, false),
    autoplay: boolOr(properties.autoplay, false),
    stream_paused: boolOr(properties.stream_paused, false),
    bus: parseBus(properties.bus),
    max_polyphony: intOr(properties.max_polyphony, 1),
  };

  if (properties.stream) {
    result.stream = properties.stream;
  }

  return result;
}
