/**
 * AnimationPlayer property formatter — sections shown in the details panel.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { AnimationProcessMode, type AnimationPlayerProperties, MethodCallMode } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatAnimationPlayerProperties(
  properties: AnimationPlayerProperties
): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Playback',
    items: [
      { label: 'Speed Scale', value: properties.speed_scale.toFixed(3) },
      { label: 'Active', value: properties.playback_active ? 'true' : 'false' },
      { label: 'Autoplay', value: properties.autoplay.length > 0 ? properties.autoplay : '(none)' },
      {
        label: 'Current Animation',
        value: properties.current_animation.length > 0 ? properties.current_animation : '(none)',
      },
      {
        label: 'Blend Time (s)',
        value: properties.playback_default_blend_time.toFixed(3),
      },
      { label: 'Process Mode', value: processModeName(properties.playback_process_mode) },
      { label: 'Method Call Mode', value: methodCallModeName(properties.method_call_mode) },
    ],
  });

  if (properties.clips.length > 0) {
    sections.push({
      title: `Clips (${properties.clips.length})`,
      items: properties.clips.map((clip, i) => ({
        label: `[${i}]`,
        value: clip.name,
      })),
    });
  } else {
    sections.push({
      title: 'Clips',
      items: [{ label: 'Count', value: '0 — no animations defined' }],
    });
  }

  sections.push(...formatNode3DProperties(properties));

  return sections;
}

function processModeName(mode: AnimationProcessMode): string {
  switch (mode) {
    case AnimationProcessMode.PHYSICS: return 'Physics';
    case AnimationProcessMode.IDLE: return 'Idle';
    case AnimationProcessMode.MANUAL: return 'Manual';
    default: return 'Unknown';
  }
}

function methodCallModeName(mode: MethodCallMode): string {
  switch (mode) {
    case MethodCallMode.DEFERRED: return 'Deferred';
    case MethodCallMode.IMMEDIATE: return 'Immediate';
    default: return 'Unknown';
  }
}
