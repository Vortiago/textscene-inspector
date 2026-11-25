import { PlaybackType } from '../../../../../../godot/audio/audioServer';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { audioMixingSection, audioStreamSection } from '../shared/audioSections';

function playbackTypeName(type: number): string {
  switch (type) {
    case PlaybackType.DEFAULT:
      return 'Default';
    case PlaybackType.STREAM:
      return 'Stream';
    case PlaybackType.SAMPLE:
      return 'Sample';
    default:
      return 'Unknown';
  }
}

export async function formatAudioStreamPlayer2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'max_distance',
    'attenuation',
    'panning_strength',
    'area_mask',
    'playback_type',
  ]);
  return [
    await audioStreamSection(node),
    await audioMixingSection(node),
    {
      title: 'Spatial',
      items: [
        { label: 'Max Distance', value: values.number('max_distance').toFixed(2) },
        { label: 'Attenuation', value: values.number('attenuation').toFixed(2) },
        { label: 'Panning Strength', value: values.number('panning_strength').toFixed(2) },
        { label: 'Area Mask', value: `0x${values.number('area_mask').toString(16)}` },
        { label: 'Playback Type', value: playbackTypeName(values.number('playback_type')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
