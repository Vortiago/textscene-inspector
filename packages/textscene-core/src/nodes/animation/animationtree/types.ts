/**
 * AnimationTree type definitions.
 *
 * Property surface mirrors linterParser.ts validators.
 * AnimationTree coordinates an AnimationPlayer and a tree-root resource
 * (AnimationNodeBlendTree / AnimationNodeStateMachine) for blended playback.
 */

import type { Node3DProperties } from '../../base/node3d/types';

/** Godot AnimationTree::AnimationProcessCallback */
export enum AnimationTreeProcessMode {
  PHYSICS = 0,
  IDLE = 1,
  MANUAL = 2,
}

/** Godot AnimationTree::AnimationCallbackModeMethod */
export enum CallbackModeMethod {
  DEFERRED = 0,
  IMMEDIATE = 1,
}

/** Godot AnimationTree::AnimationCallbackModeDiscrete */
export enum CallbackModeDiscrete {
  DOMINANT = 0,
  RECESSIVE = 1,
  FORCE_CONTINUOUS = 2,
}

export interface AnimationTreeProperties extends Node3DProperties {
  /** SubResource/ExtResource reference to the animation tree root node. */
  tree_root?: string;

  /** NodePath to the AnimationPlayer that provides animations. */
  anim_player: string;

  /** Whether the tree is currently processing (default: false). */
  active: boolean;

  /** Process callback mode (default: IDLE). */
  process_callback: AnimationTreeProcessMode;

  /** Callback mode for process (default: IDLE). */
  callback_mode_process: AnimationTreeProcessMode;

  /** Callback mode for methods (default: DEFERRED). */
  callback_mode_method: CallbackModeMethod;

  /** Callback mode for discrete transitions (default: DOMINANT). */
  callback_mode_discrete: CallbackModeDiscrete;

  /** NodePath track used for root motion extraction (empty = disabled). */
  root_motion_track: string;

  /** NodePath to the base node for advance expressions. */
  advance_expression_base_node: string;

  /** Maximum simultaneous audio voices (default: 32). */
  audio_max_polyphony: number;

  /** NodePath to the node the tree roots from (default: NodePath("..")). */
  root_node: string;

  /** Whether timing is deterministic (default: false). */
  deterministic: boolean;

  /** Reset the tree to the bind pose on save (default: true). */
  reset_on_save: boolean;

  /** Whether root motion is extracted in local space (default: false). */
  root_motion_local: boolean;
}
