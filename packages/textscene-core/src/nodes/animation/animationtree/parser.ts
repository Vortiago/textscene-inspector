/**
 * AnimationTree parser — lenient parser for the renderer.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
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
  const baseProps = parseNode3D(heading, properties);

  const result: AnimationTreeProperties = {
    ...baseProps,
    anim_player: properties.anim_player ?? 'NodePath("..")',
    active: boolOr(properties.active, false),
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
    callback_mode_discrete: enumOr(
      properties.callback_mode_discrete,
      CallbackModeDiscrete.DOMINANT,
      [CallbackModeDiscrete.DOMINANT, CallbackModeDiscrete.RECESSIVE, CallbackModeDiscrete.FORCE_CONTINUOUS]
    ),
    root_motion_track: properties.root_motion_track ?? 'NodePath("")',
    advance_expression_base_node: properties.advance_expression_base_node ?? 'NodePath("..")',
    audio_max_polyphony: intOr(properties.audio_max_polyphony, 32),
    root_node: properties.root_node ?? 'NodePath("..")',
    deterministic: boolOr(properties.deterministic, false),
    reset_on_save: boolOr(properties.reset_on_save, true),
    root_motion_local: boolOr(properties.root_motion_local, false),
  };

  if (properties.tree_root !== undefined) {
    result.tree_root = properties.tree_root;
  }

  return result;
}
