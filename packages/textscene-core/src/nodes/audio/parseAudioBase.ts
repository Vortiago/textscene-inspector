/**
 * Shared audio-stream base parser — decodes the fields common to
 * AudioStreamPlayer / 2D / 3D (volume/pitch/playing/autoplay/stream_paused +
 * bus + max_polyphony, plus the optional stream reference). Each node parser
 * spreads the result and adds its own spatial fields. Pass `context` to label
 * malformed-value warnings; omit it to keep the shared decoders' default label.
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
