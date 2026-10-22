/**
 * AnimationPlayer property formatter: the sections the details panel shows.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { type AnimationPlayerProperties } from './types';
import { AnimationCallbackModeProcess, AnimationCallbackModeMethod } from '../../../godot/scene/animation';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export function formatAnimationPlayerProperties(properties: AnimationPlayerProperties): PropertySection[] {
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

function methodCallModeName(mode: EnumValue<typeof AnimationCallbackModeMethod>): string {
  switch (mode) {
    case AnimationCallbackModeMethod.DEFERRED:
      return 'Deferred';
    case AnimationCallbackModeMethod.IMMEDIATE:
      return 'Immediate';
    default:
      return 'Unknown';
  }
}
