/**
 * AnimationTree property formatter: the sections the details panel shows.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { type AnimationTreeProperties } from './types';
import { nodePathLiteral } from '../../../godot/variant/variantParser.js';
import {
  ANIMATION_CALLBACK_MODE_DISCRETE_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES,
} from '../../../godot/scene/animation';

export function formatAnimationTreeProperties(properties: AnimationTreeProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const animPlayerPath = extractNodePath(properties.anim_player);

  sections.push({
    title: 'AnimationTree',
    items: [
      { label: 'Active', value: properties.active ? 'true' : 'false' },
      { label: 'Tree Root', value: properties.tree_root ?? '(none)' },
      { label: 'AnimationPlayer', value: animPlayerPath },
      {
        label: 'Process Callback',
        value: ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES[properties.process_callback] ?? 'Unknown',
      },
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
      {
        label: 'Callback Mode Process',
        value: ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES[properties.callback_mode_process] ?? 'Unknown',
      },
      {
        label: 'Callback Mode Method',
        value: ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES[properties.callback_mode_method] ?? 'Unknown',
      },
      {
        label: 'Callback Mode Discrete',
        value: ANIMATION_CALLBACK_MODE_DISCRETE_HINT_NAMES[properties.callback_mode_discrete] ?? 'Unknown',
      },
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
