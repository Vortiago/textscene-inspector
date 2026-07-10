/**
 * Timer property formatter — surfaces wait_time/autostart/one_shot/paused/
 * process_callback/ignore_time_scale (Godot defaults when the TSCN omits
 * them). Timer is non-spatial (extends Node), so no transform section.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { TimerProperties } from './types';

function processCallbackName(value: number): string {
  return value === 0 ? 'Physics' : 'Idle';
}

export function formatTimerProperties(properties: TimerProperties): PropertySection[] {
  return [
    {
      title: 'Timer',
      items: [
        { label: 'Wait Time (s)', value: (properties.wait_time ?? 1).toFixed(2) },
        { label: 'Autostart', value: (properties.autostart ?? false).toString() },
        { label: 'One Shot', value: (properties.one_shot ?? false).toString() },
        { label: 'Paused', value: (properties.paused ?? false).toString() },
        { label: 'Process Callback', value: processCallbackName(properties.process_callback ?? 1) },
        { label: 'Ignore Time Scale', value: (properties.ignore_time_scale ?? false).toString() },
      ],
    },
  ];
}
