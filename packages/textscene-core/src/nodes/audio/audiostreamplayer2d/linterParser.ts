/**
 * AudioStreamPlayer2D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { streamValidator } from '../streamValidator.js';

const PLAYBACK_TYPE = { 0: 'DEFAULT', 1: 'STREAM', 2: 'SAMPLE' };

validatorRegistry.registerAll('AudioStreamPlayer2D', {
  stream: streamValidator,
  volume_db: v.float('volume_db'),
  pitch_scale: v.float('pitch_scale', {
    min: Number.MIN_VALUE,
    message:
      "Property 'pitch_scale' must be greater than 0. Zero or negative pitch breaks audio playback.",
  }),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  max_distance: v.positiveFloat('max_distance'),
  attenuation: v.positiveFloat('attenuation'),
  panning_strength: v.float('panning_strength', { min: 0, max: 1 }),
  area_mask: v.int('area_mask', {
    min: 0,
    max: 1048575,
    message:
      "Property 'area_mask' must be between 0 and 1048575. Valid range: 20-bit bitmask",
  }),
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE),
  bus: busValidator,
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
  }),
});
