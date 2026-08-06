/** AudioStreamPlayer strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { busValidator } from '../busValidator.js';

validatorRegistry.registerAll('AudioStreamPlayer', {
  stream: v.resourceReference('stream'),
  volume_db: v.float('volume_db'),
  // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0.0).
  pitch_scale: v.positiveFloat('pitch_scale', undefined, {
    enforced: 'audio_stream_player_internal.cpp:314',
  }),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  bus: busValidator,
  // audio_stream_player_internal.cpp:322 drops the write when <= 0.
  max_polyphony: v.int('max_polyphony', { min: 1, enforced: 'audio_stream_player_internal.cpp:322' }),
});
