import { describe, it, expect } from 'vitest';
import { formatPointLight2DProperties } from './propertyFormatter';
import { parsePointLight2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('formatPointLight2DProperties', () => {
  it('lists the height and the texture scale in the Light section', () => {
    const props = parsePointLight2D(heading('PointLight2D', { name: 'Torch' }), {
      height: '50',
      texture_scale: '2',
    });
    const light = formatPointLight2DProperties(props).find((section) => section.title === 'Light');
    expect(light?.items).toContainEqual({ label: 'Height', value: '50 px' });
    expect(light?.items).toContainEqual({ label: 'Texture Scale', value: '2.00' });
  });
});
