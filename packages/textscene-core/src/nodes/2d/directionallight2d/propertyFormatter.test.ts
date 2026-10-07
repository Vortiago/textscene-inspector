import { describe, it, expect } from 'vitest';
import { formatDirectionalLight2DProperties } from './propertyFormatter';
import { parseDirectionalLight2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

function itemsOf(properties: Record<string, string>, title: string) {
  const props = parseDirectionalLight2D(heading('DirectionalLight2D', { name: 'Sun' }), properties);
  return formatDirectionalLight2DProperties(props).find((section) => section.title === title)?.items ?? [];
}

describe('formatDirectionalLight2DProperties', () => {
  it('lists height and max_distance in the Light section', () => {
    const items = itemsOf({ height: '0.5', max_distance: '2000' }, 'Light');
    expect(items).toContainEqual({ label: 'Height', value: '0.50' });
    expect(items).toContainEqual({ label: 'Max Distance', value: '2000 px' });
  });

  it('lists the shadow surface it inherits from Light2D', () => {
    const items = itemsOf({ shadow_enabled: 'true', shadow_filter: '2' }, 'Shadow');
    expect(items).toContainEqual({ label: 'Enabled', value: 'Yes' });
    expect(items).toContainEqual({ label: 'Filter', value: 'PCF13' });
  });

  it('labels an out-of-range blend mode with its raw number', () => {
    const props = { ...parseDirectionalLight2D(heading('DirectionalLight2D', { name: 'Sun' }), {}) };
    (props as { blend_mode: number }).blend_mode = 7;
    const light = formatDirectionalLight2DProperties(props).find((section) => section.title === 'Light');
    expect(light?.items).toContainEqual({ label: 'Blend Mode', value: '7' });
  });
});
