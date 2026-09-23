/**
 * AudioStreamPlayer2D property formatter: the sections the details panel
 * shows. Calls out the "not played in preview" status so users
 * understand the gizmo is metadata-only.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { PlaybackType, type AudioStreamPlayer2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { audioMixingSection, audioStreamSection } from '../audioStreamSection';

export function formatAudioStreamPlayer2DProperties(
  properties: AudioStreamPlayer2DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    audioStreamSection(properties),
    audioMixingSection(properties),
  ];

  sections.push({
    title: 'Spatial',
    items: [
      { label: 'Max Distance', value: properties.max_distance.toFixed(2) },
      { label: 'Attenuation', value: properties.attenuation.toFixed(2) },
      { label: 'Panning Strength', value: properties.panning_strength.toFixed(2) },
      { label: 'Area Mask', value: `0x${properties.area_mask.toString(16)}` },
      { label: 'Playback Type', value: playbackTypeName(properties.playback_type) },
    ],
  });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}

function playbackTypeName(type: PlaybackType): string {
  switch (type) {
    case PlaybackType.DEFAULT: return 'Default';
    case PlaybackType.STREAM: return 'Stream';
    case PlaybackType.SAMPLE: return 'Sample';
    default: return 'Unknown';
  }
}
