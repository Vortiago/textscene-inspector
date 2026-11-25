import { describe, it, expect } from 'vitest';
import { formatPointLight2DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

describe('formatPointLight2DProperties', () => {
  it('lists the height and the texture scale in the Light section', async () => {
    const sections = await sectionsOf(formatPointLight2DProperties, 'PointLight2D', {
      height: '50',
      texture_scale: '2',
    });
    const light = sectionTitled(sections, 'Light');
    expect(light?.items).toContainEqual({ label: 'Height', value: '50 px' });
    expect(light?.items).toContainEqual({ label: 'Texture Scale', value: '2.00' });
  });
});
