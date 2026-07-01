/**
 * AudioStreamPlayer2D parser — parses 13 properties from the linter's
 * authoritative surface plus inherited Node2D transform.
 *
 * Godot defaults follow the engine's @export var declarations. The
 * parser tolerates missing values (uses defaults) and malformed numbers
 * (logs a warn through the shared logger and falls back to default).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseBus } from '../parseBus';
import { PlaybackType } from './types';
import type { AudioStreamPlayer2DProperties } from './types';

export function parseAudioStreamPlayer2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AudioStreamPlayer2DProperties {
  const baseProps = parseNode2D(heading, properties);

  const result: AudioStreamPlayer2DProperties = {
    ...baseProps,
    volume_db: floatOr(properties.volume_db, 0),
    pitch_scale: floatOr(properties.pitch_scale, 1),
    playing: boolOr(properties.playing, false),
    autoplay: boolOr(properties.autoplay, false),
    stream_paused: boolOr(properties.stream_paused, false),
    bus: parseBus(properties.bus),
    max_polyphony: intOr(properties.max_polyphony, 1),
    max_distance: floatOr(properties.max_distance, 0),
    attenuation: floatOr(properties.attenuation, 1),
    panning_strength: floatOr(properties.panning_strength, 1),
    area_mask: intOr(properties.area_mask, 1),
    playback_type: enumOr(properties.playback_type, PlaybackType.STREAM, [
      PlaybackType.STREAM,
      PlaybackType.SAMPLE,
      PlaybackType.MAX,
    ]),
  };

  if (properties.stream) {
    result.stream = properties.stream;
  }

  return result;
}
