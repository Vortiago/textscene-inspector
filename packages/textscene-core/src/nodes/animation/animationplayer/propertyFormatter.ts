/**
 * AnimationPlayer property formatter: the sections the details panel shows.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { AnimationProcessMode, type AnimationPlayerProperties, MethodCallMode } from './types';

export function formatAnimationPlayerProperties(
  properties: AnimationPlayerProperties
): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Playback',
    items: [
      { label: 'Speed Scale', value: properties.speed_scale.toFixed(3) },
      { label: 'Active', value: properties.active ? 'true' : 'false' },
      { label: 'Autoplay', value: properties.autoplay.length > 0 ? properties.autoplay : '(none)' },
      {
        label: 'Current Animation',
        value: properties.current_animation.length > 0 ? properties.current_animation : '(none)',
      },
      {
        label: 'Blend Time (s)',
        value: properties.playback_default_blend_time.toFixed(3),
      },
      { label: 'Process Mode', value: processModeName(properties.callback_mode_process) },
      { label: 'Method Call Mode', value: methodCallModeName(properties.callback_mode_method) },
    ],
  });

  if (properties.libraries.length > 0) {
    sections.push({
      title: `Animation Libraries (${properties.libraries.length})`,
      items: properties.libraries.map((lib) => ({
        label: lib.name.length > 0 ? lib.name : '(default)',
        value: `SubResource("${lib.subResourceId}")`,
      })),
    });
  } else {
    sections.push({
      title: 'Animation Libraries',
      items: [{ label: 'Count', value: '0 — no libraries defined' }],
    });
  }

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
