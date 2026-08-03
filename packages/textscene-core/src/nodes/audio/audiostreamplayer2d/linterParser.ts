/**
 * AudioStreamPlayer2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { streamValidator } from '../streamValidator.js';

const PLAYBACK_TYPE = { 0: 'DEFAULT', 1: 'STREAM', 2: 'SAMPLE' };

validatorRegistry.registerAll('AudioStreamPlayer2D', {
  stream: streamValidator,
  volume_db: v.float('volume_db'),
  // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0.0).
  pitch_scale: v.float('pitch_scale', {
    min: Number.MIN_VALUE,
    message:
      "Property 'pitch_scale' must be greater than 0. Zero or negative pitch breaks audio playback.",
  }),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  // audio_stream_player_2d.cpp:300, ERR_FAIL_COND(p_pixels <= 0.0).
  max_distance: v.positiveFloat('max_distance'),
  // audio_stream_player_2d.cpp:437 is PROPERTY_HINT_EXP_EASING (no range) and
  // set_attenuation (:308) is a bare assignment, so there is no bound to check.
  attenuation: v.float('attenuation'),
  panning_strength: v.float('panning_strength', { min: 0, max: 1 }),
  area_mask: layerBitmask('area_mask'),
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
  }),
});
