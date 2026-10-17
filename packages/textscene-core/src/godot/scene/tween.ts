/** Godot 4.6.3's Tween facts a scene's properties carry. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/** `Tween::TransitionType` (`scene/animation/tween.h:82-96`), `TRANS_MAX` left out as a size marker. */
const TransitionType = {
  LINEAR: 0,
  SINE: 1,
  QUINT: 2,
  QUART: 3,
  QUAD: 4,
  EXPO: 5,
  ELASTIC: 6,
  CUBIC: 7,
  CIRC: 8,
  BOUNCE: 9,
  BACK: 10,
  SPRING: 11,
} as const;

/** Each transition type by its integer, as `look_at_modifier_3d.cpp:487` hints it. */
export const TRANSITION_TYPE_NAMES = relabelEnumNames(enumNamesByValue(TransitionType), pascalCaseLabel);

/** `Tween::EaseType` (`tween.h:98-104`), `EASE_MAX` left out as a size marker. */
const EaseType = {
  IN: 0,
  OUT: 1,
  IN_OUT: 2,
  OUT_IN: 3,
} as const;

/** Each ease type by its integer, as `look_at_modifier_3d.cpp:488` hints it. */
export const EASE_TYPE_NAMES = relabelEnumNames(enumNamesByValue(EaseType), pascalCaseLabel);

/** Each transition type by its integer, spelled as its constant, `LINEAR` through `SPRING`. */
export const TRANSITION_TYPE_CONSTANT_NAMES = enumNamesByValue(TransitionType);

/** Each ease type by its integer, spelled as its constant, `IN` through `OUT_IN`. */
export const EASE_TYPE_CONSTANT_NAMES = enumNamesByValue(EaseType);
