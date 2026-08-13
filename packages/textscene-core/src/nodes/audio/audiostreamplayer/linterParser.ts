/**
 * AudioStreamPlayer strict validators for linting.
 *
 * `playback_type` mirrors AudioStreamPlayer3D's validator of the same name:
 * both forward straight into AudioStreamPlayerInternal::set_playback_type
 * (audio_stream_player_internal.cpp:337-339), the SAME AudioServer::PlaybackType
 * enum (audio_server.h:194-199, "Default,Stream,Sample"), so the two are
 * genuinely one shared bound, not a coincidence of matching names.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';
import { PLAYBACK_TYPE } from '../../../linter/validators/sharedEnumLabels.js';

const MIX_TARGET = { 0: 'STEREO', 1: 'SURROUND', 2: 'CENTER' };

validatorRegistry.registerAll('AudioStreamPlayer', {
  stream: v.resourceReference('stream'),
  // audio_stream_player.cpp:282, PROPERTY_HINT_RANGE "-80,24,suffix:dB": both
  // ends closed. set_volume_db (:69-71) ERR_FAILs on NaN only and otherwise
  // assigns straight through, so out of range warns.
  volume_db: v.float('volume_db', {
    min: -80,
    max: 24,
    hinted: 'audio_stream_player.cpp:282',
  }),
  // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0.0),
  // against a hint (audio_stream_player.cpp:284) of
  // "0.01,4,0.01,or_greater" — `or_greater` opens the ceiling. The two floors
  // sit apart, so (0, 0.01) loads into Godot and only warns.
  pitch_scale: v.positiveFloat('pitch_scale', undefined, {
    hintedMin: 0.01,
    enforced: 'audio_stream_player_internal.cpp:314',
    hinted: 'audio_stream_player.cpp:284',
  }),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', { min: 1, enforced: 'audio_stream_player_internal.cpp:322' }),
  // audio_stream_player.cpp:288, PROPERTY_HINT_ENUM "Stereo,Surround,Center".
  // set_mix_target (:161-163) is a bare assignment: out-of-range only warns.
  mix_target: v.enumInt('mix_target', 0, 2, MIX_TARGET, {
    hinted: 'audio_stream_player.cpp:288',
  }),
  // audio_stream_player.cpp:291, PROPERTY_HINT_ENUM "Default,Stream,Sample".
  // set_playback_type (:234-236) forwards to
  // AudioStreamPlayerInternal::set_playback_type (audio_stream_player_internal.cpp:337-339),
  // a bare assignment: out-of-range only warns.
  playback_type: v.enumInt('playback_type', 0, 2, PLAYBACK_TYPE, {
    hinted: 'audio_stream_player.cpp:291',
  }),
});
