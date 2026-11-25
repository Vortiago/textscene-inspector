import { describe, it, expect } from 'vitest';
import {
  formatBaseLightSection,
  formatBaseShadowSection,
  formatShadowSectionWithNormalBias,
} from './propertyFormatter';
import type { InspectedNode, PropertyItem, PropertySection } from '../../../inspectedNode';
import { sectionsOf } from '../../../testing/inspectedScene';

type SectionFormatter = (node: InspectedNode, ownItems?: readonly PropertyItem[]) => Promise<PropertySection>;

async function sectionOf(
  formatter: SectionFormatter,
  properties: Record<string, string> = {},
  ownItems: readonly PropertyItem[] = []
): Promise<PropertySection> {
  const [section] = await sectionsOf(
    async (node) => [await formatter(node, ownItems)],
    'OmniLight3D',
    properties
  );
  return section!;
}

function valuesByLabel(section: PropertySection): Record<string, string> {
  return Object.fromEntries(section.items.map((item) => [item.label, item.value]));
}

describe('formatBaseLightSection', () => {
  it('lists the colour and the energy the file sets', async () => {
    const section = await sectionOf(formatBaseLightSection, {
      light_color: 'Color(1, 0.5, 0, 1)',
      light_energy: '2.5',
    });

    expect(section.title).toBe('Light');
    expect(section.items).toEqual([
      { label: 'Color', value: 'Color(1, 0.5, 0, 1)' },
      { label: 'Energy', value: '2.50' },
    ]);
  });

  it("lists Godot's colour and energy of a light that sets neither", async () => {
    expect((await sectionOf(formatBaseLightSection)).items).toEqual([
      { label: 'Color', value: 'Color(1, 1, 1, 1)' },
      { label: 'Energy', value: '1.00' },
    ]);
  });

  it("appends the class's own rows", async () => {
    const own = [
      { label: 'Range', value: '10.00' },
      { label: 'Angle', value: '45.0°' },
    ];
    expect((await sectionOf(formatBaseLightSection, {}, own)).items.slice(2)).toEqual(own);
  });

  it('lists the energy to two places', async () => {
    expect(valuesByLabel(await sectionOf(formatBaseLightSection, { light_energy: '0.123' })).Energy).toBe(
      '0.12'
    );
    expect(valuesByLabel(await sectionOf(formatBaseLightSection, { light_energy: '1000' })).Energy).toBe(
      '1000.00'
    );
  });

  it('lists the negative, specular and volumetric fog rows the file sets', async () => {
    const section = await sectionOf(formatBaseLightSection, {
      light_negative: 'true',
      light_specular: '0.0',
      light_volumetric_fog_energy: '500.0',
    });
    const values = valuesByLabel(section);
    expect(values.Negative).toBe('Yes');
    expect(values.Specular).toBe('0.00');
    expect(values['Volumetric Fog Energy']).toBe('500.00');
  });

  it('lists no negative, specular or volumetric fog row the file does not set', async () => {
    const labels = (await sectionOf(formatBaseLightSection)).items.map((item) => item.label);
    expect(labels).not.toContain('Negative');
    expect(labels).not.toContain('Specular');
    expect(labels).not.toContain('Volumetric Fog Energy');
  });

  it('names a bake mode other than the default Dynamic', async () => {
    expect(
      valuesByLabel(await sectionOf(formatBaseLightSection, { light_bake_mode: '1' }))['Bake Mode']
    ).toBe('STATIC');
  });

  it('lists no row for the default Dynamic bake mode', async () => {
    expect(valuesByLabel(await sectionOf(formatBaseLightSection))['Bake Mode']).toBeUndefined();
  });
});

describe('formatBaseShadowSection', () => {
  it('lists the shadows as off when the file sets nothing', async () => {
    const section = await sectionOf(formatBaseShadowSection);
    expect(section.title).toBe('Shadows');
    expect(section.items).toEqual([{ label: 'Enabled', value: 'No' }]);
  });

  it('lists the shadows as on', async () => {
    expect((await sectionOf(formatBaseShadowSection, { shadow_enabled: 'true' })).items).toEqual([
      { label: 'Enabled', value: 'Yes' },
    ]);
  });

  it('lists the bias and the blur the file sets, bias first', async () => {
    const section = await sectionOf(formatBaseShadowSection, { shadow_blur: '2.5', shadow_bias: '0.1' });
    expect(section.items.slice(1)).toEqual([
      { label: 'Bias', value: '0.100' },
      { label: 'Blur', value: '2.50' },
    ]);
  });

  it("appends the class's own rows after the bias", async () => {
    const own = [{ label: 'Angle', value: '45.0°' }];
    const section = await sectionOf(formatBaseShadowSection, { shadow_bias: '0.1' }, own);
    expect(section.items.map((item) => item.label)).toEqual(['Enabled', 'Bias', 'Angle']);
  });

  it('lists a small and a negative bias to three places', async () => {
    expect(valuesByLabel(await sectionOf(formatBaseShadowSection, { shadow_bias: '0.001' })).Bias).toBe(
      '0.001'
    );
    expect(valuesByLabel(await sectionOf(formatBaseShadowSection, { shadow_bias: '-0.05' })).Bias).toBe(
      '-0.050'
    );
  });

  it('lists no normal bias row', async () => {
    const section = await sectionOf(formatBaseShadowSection, { shadow_normal_bias: '0.5' });
    expect(valuesByLabel(section)['Normal Bias']).toBeUndefined();
  });
});

describe('formatShadowSectionWithNormalBias', () => {
  it('lists the bias, the normal bias and the blur the file sets, in that order', async () => {
    const section = await sectionOf(formatShadowSectionWithNormalBias, {
      shadow_enabled: 'true',
      shadow_blur: '1.5',
      shadow_normal_bias: '0.8',
      shadow_bias: '0.2',
    });
    expect(section.items).toEqual([
      { label: 'Enabled', value: 'Yes' },
      { label: 'Bias', value: '0.200' },
      { label: 'Normal Bias', value: '0.800' },
      { label: 'Blur', value: '1.50' },
    ]);
  });

  it('lists no normal bias row the file does not set', async () => {
    expect(valuesByLabel(await sectionOf(formatShadowSectionWithNormalBias))['Normal Bias']).toBeUndefined();
  });

  it("appends the class's own rows after the normal bias", async () => {
    const own = [{ label: 'Shadow Mode', value: 'CUBE' }];
    const section = await sectionOf(formatShadowSectionWithNormalBias, { shadow_normal_bias: '0.8' }, own);
    expect(section.items.map((item) => item.label)).toEqual(['Enabled', 'Normal Bias', 'Shadow Mode']);
  });

  it('lists a fractional and a negative normal bias to three places', async () => {
    const values = async (bias: string) =>
      valuesByLabel(await sectionOf(formatShadowSectionWithNormalBias, { shadow_normal_bias: bias }))[
        'Normal Bias'
      ];
    expect(await values('0.1234')).toBe('0.123');
    expect(await values('-0.5')).toBe('-0.500');
  });
});
