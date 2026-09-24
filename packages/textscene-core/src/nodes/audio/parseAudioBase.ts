/**
 * Shared audio-stream base parser for the fields common to AudioStreamPlayer, 2D and 3D. Each node
 * parser spreads the result and adds its own spatial fields. `context` labels malformed-value
 * warnings. Without it the shared decoders keep their default label.
 */

import { boolOr, floatOr, intOr } from '../../parser/valueParsers';
import { parseBus } from './parseBus';
import type { AudioStreamBaseProperties } from './types';

export function parseAudioBase(
  properties: Record<string, string>,
  context?: string
): AudioStreamBaseProperties {
  const result: AudioStreamBaseProperties = {
    volume_db: floatOr(properties.volume_db, 0, context),
    pitch_scale: floatOr(properties.pitch_scale, 1, context),
    playing: boolOr(properties.playing, false, context),
    autoplay: boolOr(properties.autoplay, false, context),
    stream_paused: boolOr(properties.stream_paused, false, context),
    bus: parseBus(properties.bus),
    max_polyphony: intOr(properties.max_polyphony, 1, context),
  };

  if (properties.stream) {
    result.stream = properties.stream;
  }

  return result;
}
