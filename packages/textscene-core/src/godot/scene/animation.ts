/** Animation facts a scene carries: the AnimatedSprite family's defaults and the AnimationMixer callback modes. */

import { enumNamesByValue, labelEnumNames } from '../classdb/enumNames.js';

/**
 * The `animation` an AnimatedSprite holds before a scene assigns one: `SceneStringName(default_)`,
 * `"default"` (`scene/scene_string_names.h:131`). Both setters return on an unchanged value
 * (`animated_sprite_2d.cpp:554-556`, `sprite_3d.cpp:1432-1434`), so `animation = "default"` never
 * reaches the `frames.is_null()` `ERR_FAIL_MSG`: Godot loads it in silence, and no rule reports it.
 */
export const DEFAULT_ANIMATION_NAME = 'default';

/** `AnimationMixer::AnimationCallbackModeProcess` (`scene/animation/animation_mixer.h:54-58`). */
export const AnimationCallbackModeProcess = {
  PHYSICS: 0,
  IDLE: 1,
  MANUAL: 2,
} as const;

/**
 * Each process mode by its integer. The 3.x `process_callback` and `playback_process_mode` aliases
 * of AnimationTree and AnimationPlayer redirect to `callback_mode_process`, so they share it.
 */
export const ANIMATION_CALLBACK_MODE_PROCESS_NAMES = enumNamesByValue(AnimationCallbackModeProcess);

/** Each process mode by its integer, in the labels the inspector hint prints (`animation_mixer.cpp:2471`). */
export const ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES = labelEnumNames(AnimationCallbackModeProcess, {
  PHYSICS: 'Physics',
  IDLE: 'Idle',
  MANUAL: 'Manual',
});

/** `AnimationMixer::AnimationCallbackModeMethod` (`animation_mixer.h:60-63`). */
export const AnimationCallbackModeMethod = {
  DEFERRED: 0,
  IMMEDIATE: 1,
} as const;

/** Each method mode by its integer. AnimationPlayer's `method_call_mode` alias shares it. */
export const ANIMATION_CALLBACK_MODE_METHOD_NAMES = enumNamesByValue(AnimationCallbackModeMethod);

/** Each method mode by its integer, in the labels the inspector hint prints (`animation_mixer.cpp:2472`). */
export const ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES = labelEnumNames(AnimationCallbackModeMethod, {
  DEFERRED: 'Deferred',
  IMMEDIATE: 'Immediate',
});

/** `AnimationMixer::AnimationCallbackModeDiscrete` (`animation_mixer.h:65-69`). */
export const AnimationCallbackModeDiscrete = {
  DOMINANT: 0,
  RECESSIVE: 1,
  FORCE_CONTINUOUS: 2,
} as const;

/** Each discrete mode by its integer. */
export const ANIMATION_CALLBACK_MODE_DISCRETE_NAMES = enumNamesByValue(AnimationCallbackModeDiscrete);

/** Each discrete mode by its integer, in the labels the inspector hint prints (`animation_mixer.cpp:2473`). */
export const ANIMATION_CALLBACK_MODE_DISCRETE_HINT_NAMES = labelEnumNames(AnimationCallbackModeDiscrete, {
  DOMINANT: 'Dominant',
  RECESSIVE: 'Recessive',
  FORCE_CONTINUOUS: 'Force Continuous',
});

/** `Animation::LoopMode` (`scene/resources/animation.h:74-78`). */
export const AnimationLoopMode = {
  NONE: 0,
  LINEAR: 1,
  PINGPONG: 2,
} as const;
