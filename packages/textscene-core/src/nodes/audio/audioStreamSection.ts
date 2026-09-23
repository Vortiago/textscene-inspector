/**
 * Shared audio property-formatter sections: the "Stream" panel, identical across AudioStreamPlayer,
 * 2D and 3D, and the base "Mixing" panel of the non-spatial and 2D formatters. The 3D formatter
 * interleaves extra rows and keeps its own.
 */

import type { PropertySection } from '../../core/NodeRegistry';
import type { AudioStreamBaseProperties } from './types';
import { yesNo } from './yesNo';

export function audioStreamSection(properties: AudioStreamBaseProperties): PropertySection {
  return {
    title: 'Stream',
    items: [
      { label: 'Stream', value: properties.stream ?? '(none)' },
      { label: 'Bus', value: properties.bus },
      { label: 'Autoplay', value: yesNo(properties.autoplay) },
      { label: 'Playing', value: yesNo(properties.playing) },
      { label: 'Status', value: 'Audio is not played in preview' },
    ],
  };
}

export function audioMixingSection(properties: AudioStreamBaseProperties): PropertySection {
  return {
    title: 'Mixing',
    items: [
      { label: 'Volume (dB)', value: properties.volume_db.toFixed(2) },
      { label: 'Pitch Scale', value: properties.pitch_scale.toFixed(3) },
      { label: 'Max Polyphony', value: properties.max_polyphony.toString() },
    ],
  };
}
