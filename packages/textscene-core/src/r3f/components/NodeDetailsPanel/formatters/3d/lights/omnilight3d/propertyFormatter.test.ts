import { describe, it, expect } from 'vitest';
import { formatOmniLight3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionTitled(await sectionsOf(formatOmniLight3DProperties, 'OmniLight3D', properties), title);
}

describe('formatOmniLight3DProperties', () => {
  it('lists the shared light rows, then the range and the attenuation', async () => {
    expect((await section('Light'))!.items).toEqual([
      { label: 'Color', value: 'Color(1, 1, 1, 1)' },
      { label: 'Energy', value: '1.00' },
      { label: 'Range', value: '5.00' },
      { label: 'Attenuation', value: '1.00' },
    ]);
  });

  it('lists the range and the attenuation the file sets', async () => {
    const light = await section('Light', { omni_range: '12.5', omni_attenuation: '2.25' });
    expect(light!.items).toContainEqual({ label: 'Range', value: '12.50' });
    expect(light!.items).toContainEqual({ label: 'Attenuation', value: '2.25' });
  });

  it('lists no shadow mode row when the file sets none', async () => {
    expect((await section('Shadows'))!.items).toEqual([{ label: 'Enabled', value: 'No' }]);
  });

  it('names each omni_shadow_mode, and an unknown one by its number', async () => {
    const modeLabel = async (mode: string) =>
      (await section('Shadows', { omni_shadow_mode: mode }))!.items.find((i) => i.label === 'Shadow Mode')!
        .value;

    expect(await modeLabel('0')).toBe('DUAL_PARABOLOID');
    expect(await modeLabel('1')).toBe('CUBE');
    expect(await modeLabel('7')).toBe('Unknown (7)');
  });

  it('lists the normal bias and the shadow mode together when the file sets both', async () => {
    const shadows = await section('Shadows', {
      shadow_enabled: 'true',
      shadow_normal_bias: '0.03',
      omni_shadow_mode: '1',
    });
    expect(shadows!.items).toEqual([
      { label: 'Enabled', value: 'Yes' },
      { label: 'Normal Bias', value: '0.030' },
      { label: 'Shadow Mode', value: 'CUBE' },
    ]);
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
