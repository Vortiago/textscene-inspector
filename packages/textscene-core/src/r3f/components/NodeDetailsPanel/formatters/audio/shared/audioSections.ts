import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { resourceText } from '../../valueText';

export async function audioStreamSection(node: InspectedNode): Promise<PropertySection> {
  const values = await node.read(['stream', 'bus', 'autoplay', 'playing']);
  return {
    title: 'Stream',
    items: [
      { label: 'Stream', value: resourceText(values.resource('stream')) },
      { label: 'Bus', value: values.string('bus') },
      { label: 'Autoplay', value: String(values.boolean('autoplay')) },
      { label: 'Playing', value: String(values.boolean('playing')) },
      { label: 'Status', value: 'Audio is not played in preview' },
    ],
  };
}

export async function audioMixingSection(node: InspectedNode): Promise<PropertySection> {
  const values = await node.read(['volume_db', 'pitch_scale', 'max_polyphony']);
  return {
    title: 'Mixing',
    items: [
      { label: 'Volume (dB)', value: values.number('volume_db').toFixed(2) },
      { label: 'Pitch Scale', value: values.number('pitch_scale').toFixed(3) },
      { label: 'Max Polyphony', value: values.number('max_polyphony').toString() },
    ],
  };
}
