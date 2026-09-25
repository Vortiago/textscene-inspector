/**
 * AnimationTree type definitions. The property surface mirrors the linterParser.ts validators.
 * An AnimationTree coordinates an AnimationPlayer and a tree-root resource
 * (AnimationNodeBlendTree or AnimationNodeStateMachine) for blended playback.
 */

import type { NodeProperties } from '../../node/types';

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

export interface AnimationTreeProperties extends NodeProperties {
  /** SubResource/ExtResource reference to the animation tree root node. */
  tree_root?: string;

  /**
   * Authored blend-tree or state-machine state, keyed without the `parameters/`
   * prefix (for example `gun/blend_amount` → `0.0`). A static previewer has no game
   * script driving these, so the tree evaluates against this saved state.
   */
  parameters: Record<string, string>;

  /** NodePath to the AnimationPlayer that provides animations. */
  anim_player: string;

  /** Whether the mixer applies anything (default: true, animation_mixer.h:137). */
  active: boolean;

  /** Process callback mode (default: IDLE). */
  process_callback: AnimationTreeProcessMode;

  /** Callback mode for process (default: IDLE). */
  callback_mode_process: AnimationTreeProcessMode;

  /** Callback mode for methods (default: DEFERRED). */
  callback_mode_method: CallbackModeMethod;

  /** Callback mode for discrete transitions (default: FORCE_CONTINUOUS, AnimationTree's override). */
  callback_mode_discrete: CallbackModeDiscrete;

  /** NodePath track used for root motion extraction (empty = disabled). */
  root_motion_track: string;

  /** NodePath to the base node for advance expressions. */
  advance_expression_base_node: string;

  /** Maximum simultaneous audio voices (default: 32). */
  audio_max_polyphony: number;

  /** NodePath to the node the tree roots from (default: NodePath("..")). */
  root_node: string;

  /** Whether timing is deterministic (default: true, AnimationTree's override). */
  deterministic: boolean;

  /** Reset the tree to the bind pose on save (default: true). */
  reset_on_save: boolean;

  /** Whether root motion is extracted in local space (default: false). */
  root_motion_local: boolean;
}
