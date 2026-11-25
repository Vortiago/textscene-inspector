import { describe, it, expect } from 'vitest';
import { formatDirectionalLight2DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

async function itemsOf(properties: Record<string, string>, title: string) {
  const sections = await sectionsOf(formatDirectionalLight2DProperties, 'DirectionalLight2D', properties);
  return sectionTitled(sections, title)?.items ?? [];
}

describe('formatDirectionalLight2DProperties', () => {
  it('lists height and max_distance in the Light section', async () => {
    const items = await itemsOf({ height: '0.5', max_distance: '2000' }, 'Light');
    expect(items).toContainEqual({ label: 'Height', value: '0.50' });
    expect(items).toContainEqual({ label: 'Max Distance', value: '2000 px' });
  });

  it('lists the shadow surface it inherits from Light2D', async () => {
    const items = await itemsOf({ shadow_enabled: 'true', shadow_filter: '2' }, 'Shadow');
    expect(items).toContainEqual({ label: 'Enabled', value: 'Yes' });
    expect(items).toContainEqual({ label: 'Filter', value: 'PCF13' });
  });

  it('labels an out-of-range blend mode with its number', async () => {
    expect(await itemsOf({ blend_mode: '7' }, 'Light')).toContainEqual({ label: 'Blend Mode', value: '7' });
  });
});
