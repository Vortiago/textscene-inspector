/**
 * AudioStreamPlayer3D parser — parses 19 properties from the linter's
 * authoritative surface plus inherited Node3D transform.
 *
 * Godot defaults follow the engine's @export var declarations. The
 * parser tolerates missing values (uses defaults) and malformed numbers
 * (logs a warn through the shared logger and falls back to default).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { boolOr, enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import {
  AttenuationModel,
  type AudioStreamPlayer3DProperties,
  DopplerTracking,
} from './types';

export function isAudioStreamPlayer3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'AudioStreamPlayer3D';
}

export function parseAudioStreamPlayer3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AudioStreamPlayer3DProperties {
  const baseProps = parseNode3D(heading, properties);

  const result: AudioStreamPlayer3DProperties = {
    ...baseProps,
    volume_db: floatOr(properties.volume_db, 0),
    pitch_scale: floatOr(properties.pitch_scale, 1),
    playing: boolOr(properties.playing, false),
    autoplay: boolOr(properties.autoplay, false),
    stream_paused: boolOr(properties.stream_paused, false),
    attenuation_model: enumOr(properties.attenuation_model, AttenuationModel.ATTENUATION_INVERSE_DISTANCE, [
      AttenuationModel.ATTENUATION_INVERSE_DISTANCE,
      AttenuationModel.ATTENUATION_INVERSE_SQUARE_DISTANCE,
      AttenuationModel.ATTENUATION_LOGARITHMIC,
      AttenuationModel.ATTENUATION_DISABLED,
    ]),
    unit_size: floatOr(properties.unit_size, 10),
    max_distance: floatOr(properties.max_distance, 0),
    max_db: floatOr(properties.max_db, 3),
    attenuation_filter_cutoff_hz: floatOr(properties.attenuation_filter_cutoff_hz, 5000),
    attenuation_filter_db: floatOr(properties.attenuation_filter_db, -24),
    doppler_tracking: enumOr(properties.doppler_tracking, DopplerTracking.DOPPLER_TRACKING_DISABLED, [
      DopplerTracking.DOPPLER_TRACKING_DISABLED,
      DopplerTracking.DOPPLER_TRACKING_IDLE_STEP,
      DopplerTracking.DOPPLER_TRACKING_PHYSICS_STEP,
    ]),
    panning_strength: floatOr(properties.panning_strength, 1),
    area_mask: intOr(properties.area_mask, 1),
    emission_angle_enabled: boolOr(properties.emission_angle_enabled, false),
    emission_angle_degrees: floatOr(properties.emission_angle_degrees, 45),
    emission_angle_filter_attenuation_db: floatOr(properties.emission_angle_filter_attenuation_db, -12),
    bus: parseBus(properties.bus),
    max_polyphony: intOr(properties.max_polyphony, 1),
  };

  if (properties.stream) {
    result.stream = properties.stream;
  }

  return result;
}

/**
 * Audio bus accepts both regular string literal ("Master") and Godot's
 * StringName syntax (&"Master"). Strip the wrapper and return the inner
 * value. Default: "Master" (Godot's default bus).
 */
function parseBus(raw: string | undefined): string {
  if (!raw) return 'Master';
  const trimmed = raw.startsWith('&') ? raw.slice(1) : raw;
  const stringMatch = trimmed.match(/^"(.*)"$/);
  if (stringMatch && stringMatch[1] !== undefined) {
    return stringMatch[1];
  }
  return trimmed;
}
