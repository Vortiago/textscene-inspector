import { describe, it, expect } from 'vitest';
import { formatLight2DProperties } from './propertyFormatter';
import type { InspectedNode, PropertyItem } from '../../../inspectedNode';
import { sectionsOf, sectionTitled, valueOf } from '../../../testing/inspectedScene';

function lightSections(properties: Record<string, string>, ownItems: readonly PropertyItem[] = []) {
  return sectionsOf(
    (node: InspectedNode) => formatLight2DProperties(node, ownItems),
    'PointLight2D',
    properties
  );
}

describe('formatLight2DProperties', () => {
  it("puts the light type's own items right after Blend Mode", async () => {
    const sections = await lightSections({}, [{ label: 'Height', value: '0.00' }]);
    const labels = sectionTitled(sections, 'Light')!.items.map((item) => item.label);

    expect(labels.indexOf('Height')).toBe(labels.indexOf('Blend Mode') + 1);
  });

  it('reads the windows as intervals and the enums by name', async () => {
    const sections = await lightSections({ range_layer_min: '-1', shadow_filter: '2' });

    expect(valueOf(sections, 'Range Layer')).toBe('-1 to 0');
    expect(valueOf(sections, 'Blend Mode')).toBe('ADD');
    expect(sectionTitled(sections, 'Shadow')!.items).toContainEqual({ label: 'Filter', value: 'PCF13' });
  });

  it('prints an enum value outside its labels as the number', async () => {
    expect(valueOf(await lightSections({ blend_mode: '7' }), 'Blend Mode')).toBe('7');
  });
});
