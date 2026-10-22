/**
 * AnimationTree property formatter: the sections the details panel shows.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { type AnimationTreeProperties } from './types';
import { nodePathLiteral } from '../../../godot/variant/variantParser.js';
import {
  AnimationCallbackModeProcess,
  AnimationCallbackModeDiscrete,
  AnimationCallbackModeMethod,
} from '../../../godot/scene/animation';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export function formatAnimationTreeProperties(properties: AnimationTreeProperties): PropertySection[] {
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

  return sections;
}

function extractNodePath(raw: string): string {
  return nodePathLiteral(raw) ?? raw;
}

function processModeName(mode: EnumValue<typeof AnimationCallbackModeProcess>): string {
  switch (mode) {
    case AnimationCallbackModeProcess.PHYSICS:
      return 'Physics';
    case AnimationCallbackModeProcess.IDLE:
      return 'Idle';
    case AnimationCallbackModeProcess.MANUAL:
      return 'Manual';
    default:
      return 'Unknown';
  }
}

function methodModeName(mode: EnumValue<typeof AnimationCallbackModeMethod>): string {
  switch (mode) {
    case AnimationCallbackModeMethod.DEFERRED:
      return 'Deferred';
    case AnimationCallbackModeMethod.IMMEDIATE:
      return 'Immediate';
    default:
      return 'Unknown';
  }
}

function discreteModeName(mode: EnumValue<typeof AnimationCallbackModeDiscrete>): string {
  switch (mode) {
    case AnimationCallbackModeDiscrete.DOMINANT:
      return 'Dominant';
    case AnimationCallbackModeDiscrete.RECESSIVE:
      return 'Recessive';
    case AnimationCallbackModeDiscrete.FORCE_CONTINUOUS:
      return 'Force Continuous';
    default:
      return 'Unknown';
  }
}
