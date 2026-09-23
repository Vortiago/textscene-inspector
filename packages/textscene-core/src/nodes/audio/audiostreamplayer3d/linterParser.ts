/**
 * AudioStreamPlayer3D strict validators. `bus` uses the shared `busValidator`, which accepts both
 * plain `"..."` strings and Godot's StringName literal form `&"..."`.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves
// an inherited key only when the ancestor is imported too.
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
  // audio_stream_player_3d.cpp:883, PROPERTY_HINT_RANGE "-80,80,suffix:dB", a wider ceiling than
  // the 2D and base players' 24. set_volume_db assigns straight through, so both ends warn. Its
  // one refusal is ERR_FAIL_COND_MSG(Math::is_nan(p_volume), ...): `nan` is dropped, `inf` and
  // `-inf` are stored unaltered.
  volume_db: v.float('volume_db', {
    min: -80,
    max: 80,
    hinted: 'audio_stream_player_3d.cpp:883',
    nan: 'audio_stream_player_3d.cpp:553',
  }),
  // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0.0),
  // against a hint (audio_stream_player_3d.cpp:887) of
  // "0.01,4,0.01,or_greater", where `or_greater` opens the ceiling. The two floors
  // sit apart, so (0, 0.01) loads into Godot and only warns.
  pitch_scale: v.positiveFloat(
    'pitch_scale',
    "Property 'pitch_scale' must be greater than 0. Zero or negative pitch breaks audio playback.",
    {
      min: 0.01,
      enforced: 'audio_stream_player_internal.cpp:314',
      hinted: 'audio_stream_player_3d.cpp:887',
    }
  ),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  // audio_stream_player_3d.cpp:896, PROPERTY_HINT_ENUM "Default,Stream,Sample". set_playback_type
  // (:789-791) forwards to AudioStreamPlayerInternal::set_playback_type
  // (audio_stream_player_internal.cpp:337-339), the setter and enum AudioStreamPlayer's
  // `playback_type` grounds against: a bare assignment, so out of range only warns.
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE, {
    hinted: 'audio_stream_player_3d.cpp:896',
  }),
  // audio_stream_player_3d.cpp:721, ERR_FAIL_INDEX((int)p_model, 4).
  attenuation_model: v.enumInt('attenuation_model', 0, 3, ATTENUATION_MODEL, {
    enforced: 'audio_stream_player_3d.cpp:721',
  }),
  // audio_stream_player_3d.cpp:885, PROPERTY_HINT_RANGE "0.1,100,0.01,or_greater":
  // or_greater opens the ceiling, so only the floor is a bound. set_unit_size
  // (:569-570) is a bare assignment, so below 0.1 warns.
  unit_size: v.float('unit_size', { min: 0.1, hinted: 'audio_stream_player_3d.cpp:885' }),
  // audio_stream_player_3d.cpp:660, ERR_FAIL_COND(p_metres < 0.0).
  max_distance: v.nonNegativeFloat('max_distance', { enforced: 'audio_stream_player_3d.cpp:660' }),
  // audio_stream_player_3d.cpp:886, PROPERTY_HINT_RANGE "-24,6,suffix:dB": both
  // ends closed. set_max_db (:578-579) is a bare assignment, so both warn.
  max_db: v.float('max_db', { min: -24, max: 6, hinted: 'audio_stream_player_3d.cpp:886' }),
  // audio_stream_player_3d.cpp:704 is a bare assignment; the hint at :902
  // ("1,20500,1,suffix:Hz") closes both ends with no or_greater, so both warn.
  attenuation_filter_cutoff_hz: v.float('attenuation_filter_cutoff_hz', {
    min: 1,
    max: 20500,
    hinted: 'audio_stream_player_3d.cpp:902',
  }),
  // audio_stream_player_3d.cpp:903, PROPERTY_HINT_RANGE "-80,0,0.1,suffix:dB":
  // both ends closed. set_attenuation_filter_db (:712-713) is a bare assignment.
  attenuation_filter_db: v.float('attenuation_filter_db', {
    min: -80,
    max: 0,
    hinted: 'audio_stream_player_3d.cpp:903',
  }),
  // audio_stream_player_3d.cpp:730 is a bare assignment (only an equal-check early
  // return); no engine-side range check on the raw int.
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING, {
    hinted: 'audio_stream_player_3d.cpp:905',
  }),
  // audio_stream_player_3d.cpp:777, ERR_FAIL_COND_MSG(p_panning_strength < 0, ...)
  // enforces the floor only. The hint (:893) is "0,3,0.01,or_greater": or_greater
  // opens the ceiling, so values above 1 are legal.
  panning_strength: v.float('panning_strength', {
    min: 0,
    enforced: { min: 'audio_stream_player_3d.cpp:777' },
  }),
  // Bare uint32_t assignment (:669): the parameter type is the ceiling.
  area_mask: layerBitmask('area_mask', { hinted: 'audio_stream_player_3d.cpp:895', width: 'uint32' /* audio_stream_player_3d.h:175 */ }),
  emission_angle_enabled: v.boolean('emission_angle_enabled'),
  // Two tiers: audio_stream_player_3d.cpp:687 ERR_FAIL_CONDs `p_angle < 0 || p_angle > 90`, while
  // the hint at :899 reads "0.1,90,0.1,degrees", a unit label, not `radians_as_degrees`. So [0, 0.1)
  // loads, the inspector excludes it and it warns, while anything under 0 errors. Both agree at 90,
  // so that end is one tier, the setter's.
  emission_angle_degrees: v.float('emission_angle_degrees', {
    enforcedMin: { at: 0 },
    min: 0.1,
    max: 90,
    enforced: {
      min: 'audio_stream_player_3d.cpp:687',
      max: 'audio_stream_player_3d.cpp:687',
    },
    hinted: { min: 'audio_stream_player_3d.cpp:899' },
  }),
  // audio_stream_player_3d.cpp:900, PROPERTY_HINT_RANGE "-80,0,0.1,suffix:dB":
  // both ends closed. set_emission_angle_filter_attenuation_db (:696-697) is a
  // bare assignment.
  emission_angle_filter_attenuation_db: v.float('emission_angle_filter_attenuation_db', {
    min: -80,
    max: 0,
    hinted: 'audio_stream_player_3d.cpp:900',
  }),
  bus: busValidator,
  // audio_stream_player_internal.cpp:323 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
    enforced: 'audio_stream_player_internal.cpp:323',
  }),
});
