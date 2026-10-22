/**
 * AnimationPlayer property formatter: the sections the details panel shows.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { type AnimationPlayerProperties } from './types';
import {
  ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES,
} from '../../../godot/scene/animation';

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
      {
        label: 'Process Mode',
        value: ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES[properties.callback_mode_process] ?? 'Unknown',
      },
      {
        label: 'Method Call Mode',
        value: ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES[properties.callback_mode_method] ?? 'Unknown',
      },
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
