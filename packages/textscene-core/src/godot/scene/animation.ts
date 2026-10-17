/** Animation facts a scene carries: the AnimatedSprite family's defaults and the AnimationMixer callback modes. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * The `animation` an AnimatedSprite holds before a scene assigns one: `SceneStringName(default_)`,
 * `"default"` (`scene/scene_string_names.h:131`). Both setters return on an unchanged value
 * (`animated_sprite_2d.cpp:554-556`, `sprite_3d.cpp:1432-1434`), so `animation = "default"` never
 * reaches the `frames.is_null()` `ERR_FAIL_MSG`: Godot loads it in silence, and no rule reports it.
 */
export const DEFAULT_ANIMATION_NAME = 'default';

/** `AnimationMixer::AnimationCallbackModeProcess` (`scene/animation/animation_mixer.h:54-58`). */
const AnimationCallbackModeProcess = {
  PHYSICS: 0,
  IDLE: 1,
  MANUAL: 2,
} as const;

/**
 * Each process mode by its integer. The 3.x `process_callback` and `playback_process_mode` aliases
 * of AnimationTree and AnimationPlayer redirect to `callback_mode_process`, so they share it.
 */
export const ANIMATION_CALLBACK_MODE_PROCESS_NAMES = enumNamesByValue(AnimationCallbackModeProcess);

/** `AnimationMixer::AnimationCallbackModeMethod` (`animation_mixer.h:60-63`). */
const AnimationCallbackModeMethod = {
  DEFERRED: 0,
  IMMEDIATE: 1,
} as const;

/** Each method mode by its integer. AnimationPlayer's `method_call_mode` alias shares it. */
export const ANIMATION_CALLBACK_MODE_METHOD_NAMES = enumNamesByValue(AnimationCallbackModeMethod);

/** `AnimationMixer::AnimationCallbackModeDiscrete` (`animation_mixer.h:65-69`). */
const AnimationCallbackModeDiscrete = {
  DOMINANT: 0,
  RECESSIVE: 1,
  FORCE_CONTINUOUS: 2,
} as const;

/** Each discrete mode by its integer. */
export const ANIMATION_CALLBACK_MODE_DISCRETE_NAMES = enumNamesByValue(AnimationCallbackModeDiscrete);
