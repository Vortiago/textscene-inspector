/** Godot 4.6.3's audio node facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `AudioStreamPlayer::MixTarget` (`scene/audio/audio_stream_player.h:45-49`). */
const MixTarget = {
  STEREO: 0,
  SURROUND: 1,
  CENTER: 2,
} as const;

/** Each mix target by its integer, spelled as its constant without `MIX_TARGET_`. */
export const AUDIO_STREAM_PLAYER_MIX_TARGET_NAMES = enumNamesByValue(MixTarget);

/** `AudioStreamPlayer3D::AttenuationModel` (`scene/3d/audio_stream_player_3d.h:49-54`). */
const AttenuationModel = {
  INVERSE_DISTANCE: 0,
  INVERSE_SQUARE_DISTANCE: 1,
  LOGARITHMIC: 2,
  DISABLED: 3,
} as const;

/** Each attenuation model by its integer, spelled as its constant without `ATTENUATION_` (`audio_stream_player_3d.cpp:907-910`). */
export const AUDIO_STREAM_PLAYER_3D_ATTENUATION_MODEL_NAMES = enumNamesByValue(AttenuationModel);

/**
 * `DopplerTracking` of `AudioStreamPlayer3D` (`audio_stream_player_3d.h:56-60`), `AudioListener3D`
 * (`audio_listener_3d.h:40-44`) and `Camera3D` (`camera_3d.h:55-59`): three C++ enums with the same
 * members and no `*_MAX` sentinel, so 2 is the real ceiling and one table serves `doppler_tracking`
 * on all three.
 */
const DopplerTracking = {
  DISABLED: 0,
  IDLE_STEP: 1,
  PHYSICS_STEP: 2,
} as const;

/** Each doppler tracking mode by its integer, spelled as its constant without `DOPPLER_TRACKING_`. */
export const DOPPLER_TRACKING_NAMES = enumNamesByValue(DopplerTracking);
