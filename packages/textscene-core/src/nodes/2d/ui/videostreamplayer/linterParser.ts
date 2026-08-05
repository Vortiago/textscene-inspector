/**
 * VideoStreamPlayer strict validators for linting.
 *
 * Declare only VideoStreamPlayer's OWN members, the ones doc/classes/VideoStreamPlayer.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/v.js';

validatorRegistry.registerAll('VideoStreamPlayer', {
  // ADD_PROPERTY(PropertyInfo(Variant::INT, "audio_track", PROPERTY_HINT_RANGE, "0,128,1"), …)
  // video_stream_player.cpp:573. `set_audio_track` is a bare assignment
  // (video_stream_player.cpp:399) and forwards the index to the stream, which
  // is free to ignore it, so the span is an inspector hint and warns only.
  audio_track: v.int('audio_track', { min: 0, max: 128, hinted: 'video_stream_player.cpp:573' }),

  // ADD_PROPERTY(PropertyInfo(Variant::INT, "buffering_msec", PROPERTY_HINT_RANGE, "10,1000,suffix:ms"), …)
  // video_stream_player.cpp:582. `set_buffering_msec` is a bare assignment
  // (video_stream_player.cpp:391); the value only sizes a resampler ring buffer
  // later, so no end of the span is enforced.
  buffering_msec: v.int('buffering_msec', {
    min: 10,
    max: 1000,
    hinted: 'video_stream_player.cpp:582',
  }),

  // video_stream_player.cpp:437, `ERR_FAIL_COND(p_speed_scale < 0.0);`, so a
  // negative scale is refused and the old value survives. The hint's other end,
  // "0,4,0.001,or_greater" at video_stream_player.cpp:577, is open: `,or_greater`
  // means a 25x scale is legal and draws no diagnostic.
  speed_scale: v.nonNegativeFloat('speed_scale', { enforced: 'video_stream_player.cpp:437' }),

  // The two ends have different authority. Below: video_stream_player.cpp:421-422
  // (`if (p_db < -79) { set_volume(0); }`) collapses the value to silence, and
  // get_volume_db reports -80 for it (video_stream_player.cpp:429-430), so the
  // number does not survive. Above: the else branch, video_stream_player.cpp:424,
  // stores db_to_linear(p_db) uncapped, so "-80,24,0.01,suffix:dB" at
  // video_stream_player.cpp:575 is an inspector bound only.
  //
  // The floor is -80 rather than the setter's -79 because -80 is what Godot
  // itself writes for silence and round-trips exactly. That leaves (-80, -79)
  // uncaught, which under-reports rather than rejecting a value the engine keeps.
  volume_db: v.float('volume_db', {
    min: -80,
    max: 24,
    enforced: { min: 'video_stream_player.cpp:421' },
    hinted: { max: 'video_stream_player.cpp:575' },
  }),

  // Four plain Variant::BOOL binds with PROPERTY_HINT_NONE, so the literal is
  // the whole constraint: autoplay (video_stream_player.cpp:578), paused
  // (:579), expand (:580), loop (:581).
  autoplay: v.boolean('autoplay'),
  paused: v.boolean('paused'),
  expand: v.boolean('expand'),
  loop: v.boolean('loop'),

  // Variant::STRING_NAME with an EMPTY PROPERTY_HINT_ENUM string
  // (video_stream_player.cpp:585); _validate_property fills the choices from the
  // live AudioServer, editor-side only (video_stream_player.cpp:510-521). The bus
  // layout lives outside the scene, so this checks the literal and nothing else.
  bus: v.stringName('bus'),

  // PROPERTY_HINT_RESOURCE_TYPE "VideoStream" (video_stream_player.cpp:574): a
  // .ogv comes in as an ExtResource, an inline VideoStreamTheora as a SubResource.
  stream: v.resourceReference('stream'),
});
