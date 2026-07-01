/**
 * AudioStreamPlayer property formatter — sections shown in the
 * details panel. AudioStreamPlayer is non-spatial (no visual representation),
 * so it calls out the "not played in preview" status.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { AudioStreamPlayerProperties } from './types';

export function formatAudioStreamPlayerProperties(
  properties: AudioStreamPlayerProperties
): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Stream',
    items: [
      { label: 'Stream', value: properties.stream ?? '(none)' },
      { label: 'Bus', value: properties.bus },
      { label: 'Autoplay', value: yesNo(properties.autoplay) },
      { label: 'Playing', value: yesNo(properties.playing) },
      { label: 'Status', value: 'Audio is not played in preview' },
    ],
  });

  sections.push({
    title: 'Mixing',
    items: [
      { label: 'Volume (dB)', value: properties.volume_db.toFixed(2) },
      { label: 'Pitch Scale', value: properties.pitch_scale.toFixed(3) },
      { label: 'Max Polyphony', value: properties.max_polyphony.toString() },
    ],
  });

  return sections;
}

function yesNo(value: boolean): string {
  return value ? 'true' : 'false';
}
