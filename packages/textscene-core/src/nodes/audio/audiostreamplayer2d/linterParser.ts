/**
 * AudioStreamPlayer2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { PLAYBACK_TYPE } from '../../../linter/validators/sharedEnumLabels.js';

validatorRegistry.registerAll('AudioStreamPlayer2D', {
  // audio_stream_player_2d.cpp:429 hints PROPERTY_HINT_RESOURCE_TYPE
  // "AudioStream" (a type constraint, not a range). set_stream (:201-203)
  // delegates to AudioStreamPlayerInternal::set_stream
  // (audio_stream_player_internal.cpp:254-263), a bare assignment: format-only.
  stream: v.resourceReference('stream'),
  // audio_stream_player_2d.cpp:430, PROPERTY_HINT_RANGE "-80,24,suffix:dB": both
  // ends closed. set_volume_db (:209-211) ERR_FAILs on NaN only and otherwise
  // assigns straight through, so out of range warns.
  volume_db: v.float('volume_db', {
    min: -80,
    max: 24,
    hinted: 'audio_stream_player_2d.cpp:430',
  }),
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
  // audio_stream_player_2d.cpp:300, ERR_FAIL_COND(p_pixels <= 0.0).
  max_distance: v.positiveFloat('max_distance', undefined, {
    enforced: 'audio_stream_player_2d.cpp:300',
  }),
  // audio_stream_player_2d.cpp:437 is PROPERTY_HINT_EXP_EASING (no range) and
  // set_attenuation (:308) is a bare assignment, so there is no bound to check.
  attenuation: v.float('attenuation'),
  // audio_stream_player_2d.cpp:349, ERR_FAIL_COND_MSG(p_panning_strength < 0, ...)
  // enforces the floor only. The hint (:439) is "0,3,0.01,or_greater": or_greater
  // opens the ceiling, so there is no upper bound to check; a prior max:1 here
  // rejected legal values above 1.
  panning_strength: v.float('panning_strength', {
    min: 0,
    enforced: { min: 'audio_stream_player_2d.cpp:349' },
  }),
  // Bare uint32_t assignment (:316): the parameter type is the only ceiling, so
  // the citation is the setter signature rather than an ERR_FAIL.
  area_mask: layerBitmask('area_mask', { hinted: 'audio_stream_player_2d.cpp:441' }),
  // audio_stream_player_internal.cpp:337 is a bare assignment; no engine-side range check.
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE, {
    hinted: 'audio_stream_player_2d.cpp:442',
  }),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', {
    min: 1,
    message: "Property 'max_polyphony' must be at least 1. Values below 1 cause errors.",
    enforced: 'audio_stream_player_internal.cpp:322',
  }),
});
