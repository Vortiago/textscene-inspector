/**
 * AudioStreamPlayer3D property formatter — sections shown in the
 * details panel. Calls out the "not played in preview" status so users
 * understand the gizmo is metadata-only.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import {
  AttenuationModel,
  type AudioStreamPlayer3DProperties,
  DopplerTracking,
} from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { audioStreamSection } from '../audioStreamSection';

export function formatAudioStreamPlayer3DProperties(
  properties: AudioStreamPlayer3DProperties
): PropertySection[] {
  const sections: PropertySection[] = [audioStreamSection(properties)];

  sections.push({
    title: 'Mixing',
    items: [
      { label: 'Volume (dB)', value: properties.volume_db.toFixed(2) },
      { label: 'Pitch Scale', value: properties.pitch_scale.toFixed(3) },
      { label: 'Max Volume (dB)', value: properties.max_db.toFixed(2) },
      { label: 'Panning Strength', value: properties.panning_strength.toFixed(2) },
      { label: 'Max Polyphony', value: properties.max_polyphony.toString() },
    ],
  });

  sections.push({
    title: 'Attenuation',
    items: [
      { label: 'Model', value: attenuationName(properties.attenuation_model) },
      { label: 'Unit Size', value: properties.unit_size.toFixed(2) },
      {
        label: 'Max Distance',
        value: properties.max_distance === 0
          ? 'Unlimited'
          : properties.max_distance.toFixed(2),
      },
      { label: 'Filter Cutoff (Hz)', value: properties.attenuation_filter_cutoff_hz.toFixed(0) },
      { label: 'Filter Strength (dB)', value: properties.attenuation_filter_db.toFixed(2) },
    ],
  });

  if (properties.emission_angle_enabled) {
    sections.push({
      title: 'Emission Cone',
      items: [
        { label: 'Enabled', value: 'true' },
        { label: 'Half-angle (°)', value: properties.emission_angle_degrees.toFixed(1) },
        {
          label: 'Outside Attenuation (dB)',
          value: properties.emission_angle_filter_attenuation_db.toFixed(2),
        },
      ],
    });
  }

  sections.push({
    title: 'Spatial',
    items: [
      { label: 'Doppler Tracking', value: dopplerName(properties.doppler_tracking) },
      { label: 'Area Mask', value: `0x${properties.area_mask.toString(16)}` },
    ],
  });

  sections.push(...formatNode3DProperties(properties));

  return sections;
}

function attenuationName(mode: AttenuationModel): string {
  switch (mode) {
    case AttenuationModel.ATTENUATION_INVERSE_DISTANCE: return 'Inverse Distance';
    case AttenuationModel.ATTENUATION_INVERSE_SQUARE_DISTANCE: return 'Inverse Square';
    case AttenuationModel.ATTENUATION_LOGARITHMIC: return 'Logarithmic';
    case AttenuationModel.ATTENUATION_DISABLED: return 'Disabled';
    default: return 'Unknown';
  }
}

function dopplerName(mode: DopplerTracking): string {
  switch (mode) {
    case DopplerTracking.DOPPLER_TRACKING_DISABLED: return 'Disabled';
    case DopplerTracking.DOPPLER_TRACKING_IDLE_STEP: return 'Idle Step';
    case DopplerTracking.DOPPLER_TRACKING_PHYSICS_STEP: return 'Physics Step';
    default: return 'Unknown';
  }
}
