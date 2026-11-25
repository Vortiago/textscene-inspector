import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { instanceSection } from '../instanceSection';
import { degreesText } from '../../valueText';

function axisRows(numbers: readonly number[], text: (value: number) => string): PropertySection['items'] {
  return ['X', 'Y', 'Z'].map((label, index) => ({ label, value: text(numbers[index] ?? 0) }));
}

function isRestPose(
  position: readonly number[],
  rotation: readonly number[],
  scale: readonly number[]
): boolean {
  return [...position, ...rotation].every((value) => value === 0) && scale.every((value) => value === 1);
}

export async function formatNode3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const sections: PropertySection[] = [];
  const values = await node.read(['position', 'rotation', 'scale']);
  // A relay or a path pass can place a node whose file sets no `transform`.
  const isPlaced = !isRestPose(
    values.numbers('position'),
    values.numbers('rotation'),
    values.numbers('scale')
  );
  if (node.fileProperties.has('transform') || isPlaced) {
    sections.push(
      { title: 'Position', items: axisRows(values.numbers('position'), (value) => value.toFixed(3)) },
      { title: 'Rotation (degrees)', items: axisRows(values.numbers('rotation'), degreesText) },
      { title: 'Scale', items: axisRows(values.numbers('scale'), (value) => value.toFixed(3)) }
    );
  }
  sections.push(...(await instanceSection(node)));
  return sections;
}
