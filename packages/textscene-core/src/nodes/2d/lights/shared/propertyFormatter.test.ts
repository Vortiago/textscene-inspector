import { describe, it, expect } from 'vitest';
import { formatLight2DProperties } from './propertyFormatter';
import { parseLight2D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

function light(properties: Record<string, string> = {}) {
  return parseLight2D(heading('PointLight2D', { name: 'Light' }), properties);
}

function labels(sectionTitle: string, sections: ReturnType<typeof formatLight2DProperties>): string[] {
  return sections.find((section) => section.title === sectionTitle)!.items.map((item) => item.label);
}

describe('formatLight2DProperties', () => {
  it("puts the light type's own items right after Blend Mode", () => {
    const sections = formatLight2DProperties(light(), [{ label: 'Height', value: '0.00' }]);
    const items = labels('Light', sections);

    expect(items.indexOf('Height')).toBe(items.indexOf('Blend Mode') + 1);
  });

  it('reads the windows as intervals and the enums by name', () => {
    const sections = formatLight2DProperties(light({ range_layer_min: '-1', shadow_filter: '2' }), []);
    const values = Object.fromEntries(
      sections.flatMap((s) => s.items.map((i) => [`${s.title}.${i.label}`, i.value]))
    );

    expect(values['Light.Range Layer']).toBe('-1 to 0');
    expect(values['Light.Blend Mode']).toBe('ADD');
    expect(values['Shadow.Filter']).toBe('PCF13');
  });

  it('prints an enum value outside its labels as the number', () => {
    const props = { ...light(), blend_mode: 7 as never };

    const blend = formatLight2DProperties(props, [])[0]!.items.find((item) => item.label === 'Blend Mode');
    expect(blend?.value).toBe('7');
  });
});
