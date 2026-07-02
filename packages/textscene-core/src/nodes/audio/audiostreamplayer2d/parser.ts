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
import { enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseAudioBase } from '../parseAudioBase';
import { PlaybackType } from './types';
import type { AudioStreamPlayer2DProperties } from './types';

export function parseAudioStreamPlayer2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AudioStreamPlayer2DProperties {
  const baseProps = parseNode2D(heading, properties);

  const ctx = 'AudioStreamPlayer2D';
  return {
    ...baseProps,
    ...parseAudioBase(properties, ctx),
    max_distance: floatOr(properties.max_distance, 2000, ctx),
    attenuation: floatOr(properties.attenuation, 1, ctx),
    panning_strength: floatOr(properties.panning_strength, 1, ctx),
    area_mask: intOr(properties.area_mask, 1, ctx),
    playback_type: enumOr(properties.playback_type, PlaybackType.DEFAULT, [
      PlaybackType.DEFAULT,
      PlaybackType.STREAM,
      PlaybackType.SAMPLE,
    ], ctx),
  };
}
