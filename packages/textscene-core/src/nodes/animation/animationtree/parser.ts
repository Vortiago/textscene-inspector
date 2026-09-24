/**
 * AnimationTree lenient parser for the renderer.
 *
 * A plain Node: a Node3D below it finds no Node3D parent
 * (node_3d.cpp:150, `data.parent = Object::cast_to<Node3D>(get_parent())`),
 * so the chain is `parseNode`, which carries no `visible` or placement fields.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';
import { boolOr, enumOr, intOr } from '../../../parser/valueParsers';
import {
  AnimationTreeProcessMode,
  type AnimationTreeProperties,
  CallbackModeDiscrete,
  CallbackModeMethod,
} from './types';

export function parseAnimationTree(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimationTreeProperties {
  const baseProps = parseNode(heading, properties);

  const result: AnimationTreeProperties = {
    ...baseProps,
    parameters: collectParameters(properties),
    anim_player: properties.anim_player ?? 'NodePath("..")',
    // Godot's AnimationMixer.active defaults to true and is omitted at its
    // default, so an absent key means active. A false default would leave every
    // authored AnimationTree inert.
    active: boolOr(properties.active, true),
    process_callback: enumOr(
      properties.process_callback,
      AnimationTreeProcessMode.IDLE,
      [AnimationTreeProcessMode.PHYSICS, AnimationTreeProcessMode.IDLE, AnimationTreeProcessMode.MANUAL]
    ),
    callback_mode_process: enumOr(
      properties.callback_mode_process,
      AnimationTreeProcessMode.IDLE,
      [AnimationTreeProcessMode.PHYSICS, AnimationTreeProcessMode.IDLE, AnimationTreeProcessMode.MANUAL]
    ),
    callback_mode_method: enumOr(
      properties.callback_mode_method,
      CallbackModeMethod.DEFERRED,
      [CallbackModeMethod.DEFERRED, CallbackModeMethod.IMMEDIATE]
    ),
    // AnimationTree overrides two AnimationMixer defaults, and its own XML carries
    // `overrides="AnimationMixer"` on both: callback_mode_discrete is 2
    // (FORCE_CONTINUOUS, "the default behavior for AnimationTree") where the
    // mixer's is 1, and `deterministic` is true where the mixer's is false.
    callback_mode_discrete: enumOr(
      properties.callback_mode_discrete,
      CallbackModeDiscrete.FORCE_CONTINUOUS,
      [CallbackModeDiscrete.DOMINANT, CallbackModeDiscrete.RECESSIVE, CallbackModeDiscrete.FORCE_CONTINUOUS]
    ),
    root_motion_track: properties.root_motion_track ?? 'NodePath("")',
    // class_animationtree.html: NodePath("."). The mixer's NodePath("..") is the
    // default of `root_node`, a different property.
    advance_expression_base_node: properties.advance_expression_base_node ?? 'NodePath(".")',
    audio_max_polyphony: intOr(properties.audio_max_polyphony, 32),
    root_node: properties.root_node ?? 'NodePath("..")',
    deterministic: boolOr(properties.deterministic, true),
    reset_on_save: boolOr(properties.reset_on_save, true),
    root_motion_local: boolOr(properties.root_motion_local, false),
  };

  if (properties.tree_root !== undefined) {
    result.tree_root = properties.tree_root;
  }

  return result;
}

/** Collect `parameters/<path> = value` body lines, dropping the `parameters/` prefix. */
function collectParameters(properties: Record<string, string>): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('parameters/')) {
      parameters[key.slice('parameters/'.length)] = value;
    }
  }
  return parameters;
}
