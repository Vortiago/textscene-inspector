/**
 * AnimationPlayer type definitions.
 *
 * Property surface mirrors linterParser.ts validators.
 * Clip data (anims/* and libraries properties) is extracted as a parsed
 * structure for the details panel, since raw TSCN stores clip data as
 * sub-resources rather than simple scalars.
 */

import type { Node3DProperties } from '../../base/node3d/types';

/** Godot AnimationPlayer::AnimationProcessCallback */
export enum AnimationProcessMode {
  PHYSICS = 0,
  IDLE = 1,
  MANUAL = 2,
}

/** Godot AnimationPlayer::AnimationMethodCallMode */
export enum MethodCallMode {
  DEFERRED = 0,
  IMMEDIATE = 1,
}

/**
 * Reference to an AnimationLibrary SubResource declared on the node via
 * `libraries/<name> = SubResource("id")`. The empty-name default library is
 * written `libraries/` (so `name` is `''`). The animations themselves live in
 * the referenced AnimationLibrary sub_resource and are resolved render-side
 * (see animationResolver.ts) — the parser only captures the reference.
 */
export interface AnimationLibraryRef {
  /** Library name; `''` for the default `libraries/` library. */
  name: string;
  /** SubResource id of the referenced AnimationLibrary. */
  subResourceId: string;
}

export interface AnimationPlayerProperties extends Node3DProperties {
  /** Playback speed multiplier (default: 1.0). */
  speed_scale: number;

  /** Default blend time between animations in seconds (default: 0.0). */
  playback_default_blend_time: number;

  /** Process callback mode (default: IDLE). */
  playback_process_mode: AnimationProcessMode;

  /** Method call mode (default: DEFERRED). */
  method_call_mode: MethodCallMode;

  /** Whether the player is currently active (default: true). */
  playback_active: boolean;

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
