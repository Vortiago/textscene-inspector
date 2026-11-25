import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { instanceSection } from '../instanceSection';
import { degreesText } from '../../valueText';

function axisRows(numbers: readonly number[], text: (value: number) => string): PropertySection['items'] {
  return ['X', 'Y', 'Z'].map((label, index) => ({ label, value: text(numbers[index] ?? 0) }));
}

export async function formatNode3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const sections: PropertySection[] = [];
  if (node.fileProperties.has('transform')) {
    const values = await node.read(['position', 'rotation', 'scale']);
    sections.push(
      { title: 'Position', items: axisRows(values.numbers('position'), (value) => value.toFixed(3)) },
      { title: 'Rotation (degrees)', items: axisRows(values.numbers('rotation'), degreesText) },
      { title: 'Scale', items: axisRows(values.numbers('scale'), (value) => value.toFixed(3)) }
    );
  }
  sections.push(...(await instanceSection(node)));
  return sections;
}
