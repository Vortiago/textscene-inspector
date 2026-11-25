import { AttenuationModel, DopplerTracking } from '../../../../../../godot/scene/audio';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { audioStreamSection } from '../shared/audioSections';

const PLAYER_3D_PROPERTIES = [
  'volume_db',
  'pitch_scale',
  'max_db',
  'panning_strength',
  'max_polyphony',
  'attenuation_model',
  'unit_size',
  'max_distance',
  'attenuation_filter_cutoff_hz',
  'attenuation_filter_db',
  'emission_angle_enabled',
  'emission_angle_degrees',
  'emission_angle_filter_attenuation_db',
  'doppler_tracking',
  'area_mask',
] as const;

export async function formatAudioStreamPlayer3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(PLAYER_3D_PROPERTIES);
  const maxDistance = values.number('max_distance');
  const sections: PropertySection[] = [
    await audioStreamSection(node),
    {
      title: 'Mixing',
      items: [
        { label: 'Volume (dB)', value: values.number('volume_db').toFixed(2) },
        { label: 'Pitch Scale', value: values.number('pitch_scale').toFixed(3) },
        { label: 'Max Volume (dB)', value: values.number('max_db').toFixed(2) },
        { label: 'Panning Strength', value: values.number('panning_strength').toFixed(2) },
        { label: 'Max Polyphony', value: values.number('max_polyphony').toString() },
      ],
    },
    {
      title: 'Attenuation',
      items: [
        { label: 'Model', value: attenuationName(values.number('attenuation_model')) },
        { label: 'Unit Size', value: values.number('unit_size').toFixed(2) },
        { label: 'Max Distance', value: maxDistance === 0 ? 'Unlimited' : maxDistance.toFixed(2) },
        { label: 'Filter Cutoff (Hz)', value: values.number('attenuation_filter_cutoff_hz').toFixed(0) },
        { label: 'Filter Strength (dB)', value: values.number('attenuation_filter_db').toFixed(2) },
      ],
    },
  ];
  if (values.boolean('emission_angle_enabled')) {
    sections.push({
      title: 'Emission Cone',
      items: [
        { label: 'Enabled', value: 'true' },
        { label: 'Half-angle (°)', value: values.number('emission_angle_degrees').toFixed(1) },
        {
          label: 'Outside Attenuation (dB)',
          value: values.number('emission_angle_filter_attenuation_db').toFixed(2),
        },
      ],
    });
  }
  sections.push({
    title: 'Spatial',
    items: [
      { label: 'Doppler Tracking', value: dopplerName(values.number('doppler_tracking')) },
      { label: 'Area Mask', value: `0x${values.number('area_mask').toString(16)}` },
    ],
  });
  return [...sections, ...(await formatNode3DProperties(node))];
}

function attenuationName(mode: number): string {
  switch (mode) {
    case AttenuationModel.INVERSE_DISTANCE:
      return 'Inverse Distance';
    case AttenuationModel.INVERSE_SQUARE_DISTANCE:
      return 'Inverse Square';
    case AttenuationModel.LOGARITHMIC:
      return 'Logarithmic';
    case AttenuationModel.DISABLED:
      return 'Disabled';
    default:
      return 'Unknown';
  }
}

function dopplerName(mode: number): string {
  switch (mode) {
    case DopplerTracking.DISABLED:
      return 'Disabled';
    case DopplerTracking.IDLE_STEP:
      return 'Idle Step';
    case DopplerTracking.PHYSICS_STEP:
      return 'Physics Step';
    default:
      return 'Unknown';
  }
}
