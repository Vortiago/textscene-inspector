/**
 * AnimationPlayer type definitions. The property surface mirrors the linterParser.ts validators.
 * Clip data (`anims/*` and `libraries`) is a parsed structure for the details panel, since the
 * `.tscn` stores clips as sub-resources.
 */

import type { NodeProperties } from '../../node/types';

/** Godot AnimationMixer::AnimationCallbackModeProcess (animation_mixer.h:54) */
export enum AnimationProcessMode {
  PHYSICS = 0,
  IDLE = 1,
  MANUAL = 2,
}

/** Godot AnimationMixer::AnimationCallbackModeMethod (animation_mixer.h:60) */
export enum MethodCallMode {
  DEFERRED = 0,
  IMMEDIATE = 1,
}

/**
 * An AnimationLibrary SubResource the node references with `libraries/<name> = SubResource("id")`.
 * The parser captures only the reference. animationResolver.ts resolves the clips render-side.
 */
export interface AnimationLibraryRef {
  /** Library name; `''` for the default `libraries/` library. */
  name: string;
  /** SubResource id of the referenced AnimationLibrary. */
  subResourceId: string;
}

export interface AnimationPlayerProperties extends NodeProperties {
  /** Playback speed multiplier (default: 1.0). */
  speed_scale: number;

  /** Default blend time between animations in seconds (default: 0.0). */
  playback_default_blend_time: number;

  /** Process callback mode (default: IDLE); deprecated key `playback_process_mode`. */
  callback_mode_process: AnimationProcessMode;

  /** Method call mode (default: DEFERRED); deprecated key `method_call_mode`. */
  callback_mode_method: MethodCallMode;

  /** Whether the mixer applies anything (default: true); deprecated key `playback_active`. */
  active: boolean;

  /** Name of the animation to play automatically on ready (empty = none). */
  autoplay: string;

  /** Currently playing animation name (empty = none). */
  current_animation: string;

  /** Length of the current animation in seconds (runtime; default: 0.0). */
  current_animation_length: number;

  /** Position in the current animation in seconds (runtime; default: 0.0). */
  current_animation_position: number;

  /** Node path to the root node whose descendants are animatable. */
  root_node: string;

  /** AnimationLibrary references captured from `libraries/<name>` keys. */
  libraries: AnimationLibraryRef[];
}
