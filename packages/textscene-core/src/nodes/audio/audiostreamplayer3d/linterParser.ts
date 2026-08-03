/**
 * AudioStreamPlayer3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `stream` and `bus` use the shared audio validators: `streamValidator`
 * enforces the "ExtResource or SubResource" wording (per-node test asserts
 * this); `busValidator` accepts both plain `"..."` strings and Godot's
 * StringName literal form `&"..."`.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { streamValidator } from '../streamValidator.js';

const ATTENUATION_MODEL = {
  0: 'INVERSE_DISTANCE',
  1: 'INVERSE_SQUARE_DISTANCE',
  2: 'LOGARITHMIC',
  3: 'DISABLED',
};
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('AudioStreamPlayer3D', {
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
  attenuation_model: v.enumInt('attenuation_model', 0, 3, ATTENUATION_MODEL),
  // audio_stream_player_3d.cpp:569 is a bare assignment, so the hint at :885
  // ("0.1,100,0.01,or_greater") is advisory: below 0.1 is a warning in linter.ts.
  unit_size: v.float('unit_size'),
  // audio_stream_player_3d.cpp:660, ERR_FAIL_COND(p_metres < 0.0).
  max_distance: v.nonNegativeFloat('max_distance'),
  max_db: v.float('max_db'),
  attenuation_filter_cutoff_hz: v.float('attenuation_filter_cutoff_hz', {
    min: 1,
    message: "Property 'attenuation_filter_cutoff_hz' must be at least 1 Hz",
  }),
  attenuation_filter_db: v.float('attenuation_filter_db'),
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING),
  panning_strength: v.float('panning_strength', { min: 0, max: 1 }),
  area_mask: layerBitmask('area_mask'),
  emission_angle_enabled: v.boolean('emission_angle_enabled'),
  // audio_stream_player_3d.cpp:899, PROPERTY_HINT_RANGE "0.1,90,0.1,degrees".
  emission_angle_degrees: v.float('emission_angle_degrees', { min: 0, max: 90 }),
  emission_angle_filter_attenuation_db: v.float('emission_angle_filter_attenuation_db'),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
  }),
});
