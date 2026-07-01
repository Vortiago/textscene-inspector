/**
 * AudioStreamPlayer2D property formatter — sections shown in the
 * details panel. Calls out the "not played in preview" status so users
 * understand the gizmo is metadata-only.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { PlaybackType, type AudioStreamPlayer2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatAudioStreamPlayer2DProperties(
  properties: AudioStreamPlayer2DProperties
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

  sections.push({
    title: 'Spatial',
    items: [
      { label: 'Max Distance', value: properties.max_distance === 0 ? 'Unlimited' : properties.max_distance.toFixed(2) },
      { label: 'Attenuation', value: properties.attenuation.toFixed(2) },
      { label: 'Panning Strength', value: properties.panning_strength.toFixed(2) },
      { label: 'Area Mask', value: `0x${properties.area_mask.toString(16)}` },
      { label: 'Playback Type', value: playbackTypeName(properties.playback_type) },
    ],
  });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}

function yesNo(value: boolean): string {
  return value ? 'true' : 'false';
}

function playbackTypeName(type: PlaybackType): string {
  switch (type) {
    case PlaybackType.STREAM: return 'Stream';
    case PlaybackType.SAMPLE: return 'Sample';
    case PlaybackType.MAX: return 'MAX';
    default: return 'Unknown';
  }
}
