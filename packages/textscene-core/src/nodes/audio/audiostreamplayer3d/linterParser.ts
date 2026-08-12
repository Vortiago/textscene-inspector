/**
 * AudioStreamPlayer3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `bus` uses the shared `busValidator`, which accepts both plain `"..."`
 * strings and Godot's StringName literal form `&"..."`.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { PLAYBACK_TYPE } from '../../../linter/validators/sharedEnumLabels.js';

const ATTENUATION_MODEL = {
  0: 'INVERSE_DISTANCE',
  1: 'INVERSE_SQUARE_DISTANCE',
  2: 'LOGARITHMIC',
  3: 'DISABLED',
};
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('AudioStreamPlayer3D', {
  // audio_stream_player_3d.cpp:881 hints PROPERTY_HINT_RESOURCE_TYPE
  // "AudioStream" (a type constraint, not a range). set_stream (:544-546)
  // delegates to AudioStreamPlayerInternal::set_stream
  // (audio_stream_player_internal.cpp:254-263), a bare assignment: format-only.
  stream: v.resourceReference('stream'),
  volume_db: v.float('volume_db'),
  // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0.0).
  pitch_scale: v.float('pitch_scale', {
    min: Number.MIN_VALUE,
    message:
      "Property 'pitch_scale' must be greater than 0. Zero or negative pitch breaks audio playback.",
    enforced: 'audio_stream_player_internal.cpp:314',
  }),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  // audio_stream_player_3d.cpp:896, PROPERTY_HINT_ENUM "Default,Stream,Sample".
  // set_playback_type (:789-791) forwards to
  // AudioStreamPlayerInternal::set_playback_type (audio_stream_player_internal.cpp:337-339),
  // the SAME setter and SAME AudioServer::PlaybackType enum AudioStreamPlayer's
  // validator of the same name grounds against: a bare assignment, out-of-range
  // only warns.
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE, {
    hinted: 'audio_stream_player_3d.cpp:896',
  }),
  // audio_stream_player_3d.cpp:721, ERR_FAIL_INDEX((int)p_model, 4).
  attenuation_model: v.enumInt('attenuation_model', 0, 3, ATTENUATION_MODEL, {
    enforced: 'audio_stream_player_3d.cpp:721',
  }),
  // audio_stream_player_3d.cpp:569 is a bare assignment, so the hint at :885
  // ("0.1,100,0.01,or_greater") is advisory: below 0.1 is a warning in linter.ts.
  unit_size: v.float('unit_size'),
  // audio_stream_player_3d.cpp:660, ERR_FAIL_COND(p_metres < 0.0).
  max_distance: v.nonNegativeFloat('max_distance', { enforced: 'audio_stream_player_3d.cpp:660' }),
  max_db: v.float('max_db'),
  // audio_stream_player_3d.cpp:704 is a bare assignment; the hint at :902
  // ("1,20500,1,suffix:Hz") closes both ends with no or_greater, so both warn.
  attenuation_filter_cutoff_hz: v.float('attenuation_filter_cutoff_hz', {
    min: 1,
    max: 20500,
    hinted: 'audio_stream_player_3d.cpp:902',
  }),
  attenuation_filter_db: v.float('attenuation_filter_db'),
  // audio_stream_player_3d.cpp:730 is a bare assignment (only an equal-check early
  // return); no engine-side range check on the raw int.
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING, {
    hinted: 'audio_stream_player_3d.cpp:905',
  }),
  // audio_stream_player_3d.cpp:777, ERR_FAIL_COND_MSG(p_panning_strength < 0, ...)
  // enforces the floor only. The hint (:893) is "0,3,0.01,or_greater": or_greater
  // opens the ceiling, so a prior max:1 here rejected legal values above 1.
  panning_strength: v.float('panning_strength', {
    min: 0,
    enforced: { min: 'audio_stream_player_3d.cpp:777' },
  }),
  // Bare uint32_t assignment (:669): the parameter type is the ceiling.
  area_mask: layerBitmask('area_mask', { hinted: 'audio_stream_player_3d.cpp:895' }),
  emission_angle_enabled: v.boolean('emission_angle_enabled'),
  // audio_stream_player_3d.cpp:687, ERR_FAIL_COND(p_angle < 0 || p_angle > 90); the
  // hint at :899 is degrees (not radians_as_degrees), so no conversion applies.
  emission_angle_degrees: v.float('emission_angle_degrees', {
    min: 0,
    max: 90,
    enforced: 'audio_stream_player_3d.cpp:687',
  }),
  emission_angle_filter_attenuation_db: v.float('emission_angle_filter_attenuation_db'),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
    enforced: 'audio_stream_player_internal.cpp:322',
  }),
});
