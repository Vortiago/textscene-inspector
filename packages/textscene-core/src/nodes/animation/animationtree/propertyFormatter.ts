/**
 * AnimationTree property formatter — sections shown in the details panel.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import {
  AnimationTreeProcessMode,
  type AnimationTreeProperties,
  CallbackModeDiscrete,
  CallbackModeMethod,
} from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { nodePathLiteral } from '../../../godot/index.js';

export function formatAnimationTreeProperties(
  properties: AnimationTreeProperties
): PropertySection[] {
  const sections: PropertySection[] = [];

  const animPlayerPath = extractNodePath(properties.anim_player);

  sections.push({
    title: 'AnimationTree',
    items: [
      { label: 'Active', value: properties.active ? 'true' : 'false' },
      { label: 'Tree Root', value: properties.tree_root ?? '(none)' },
      { label: 'AnimationPlayer', value: animPlayerPath },
      { label: 'Process Callback', value: processModeName(properties.process_callback) },
    ],
  });

  const rootMotionPath = extractNodePath(properties.root_motion_track);
  if (rootMotionPath.length > 0) {
    sections.push({
      title: 'Root Motion',
      items: [
        { label: 'Track', value: rootMotionPath },
        { label: 'Local Space', value: properties.root_motion_local ? 'true' : 'false' },
      ],
    });
  }

  sections.push({
    title: 'Advanced',
    items: [
      { label: 'Callback Mode Process', value: processModeName(properties.callback_mode_process) },
      { label: 'Callback Mode Method', value: methodModeName(properties.callback_mode_method) },
      { label: 'Callback Mode Discrete', value: discreteModeName(properties.callback_mode_discrete) },
      { label: 'Audio Max Polyphony', value: properties.audio_max_polyphony.toString() },
      { label: 'Deterministic', value: properties.deterministic ? 'true' : 'false' },
      { label: 'Reset On Save', value: properties.reset_on_save ? 'true' : 'false' },
    ],
  });

  sections.push(...formatNode3DProperties(properties));

  return sections;
}

function extractNodePath(raw: string): string {
  return nodePathLiteral(raw) ?? raw;
}

function processModeName(mode: AnimationTreeProcessMode): string {
  switch (mode) {
    case AnimationTreeProcessMode.PHYSICS: return 'Physics';
    case AnimationTreeProcessMode.IDLE: return 'Idle';
    case AnimationTreeProcessMode.MANUAL: return 'Manual';
    default: return 'Unknown';
  }
}

function methodModeName(mode: CallbackModeMethod): string {
  switch (mode) {
    case CallbackModeMethod.DEFERRED: return 'Deferred';
    case CallbackModeMethod.IMMEDIATE: return 'Immediate';
    default: return 'Unknown';
  }
}

function discreteModeName(mode: CallbackModeDiscrete): string {
  switch (mode) {
    case CallbackModeDiscrete.DOMINANT: return 'Dominant';
    case CallbackModeDiscrete.RECESSIVE: return 'Recessive';
    case CallbackModeDiscrete.FORCE_CONTINUOUS: return 'Force Continuous';
    default: return 'Unknown';
  }
}
