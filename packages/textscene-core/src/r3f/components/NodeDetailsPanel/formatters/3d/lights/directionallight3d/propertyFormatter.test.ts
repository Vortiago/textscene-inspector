import { describe, it, expect } from 'vitest';
import { formatDirectionalLight3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionTitled(
    await sectionsOf(formatDirectionalLight3DProperties, 'DirectionalLight3D', properties),
    title
  );
}

describe('formatDirectionalLight3DProperties', () => {
  it('lists the colour and the energy in the Light section', async () => {
    expect((await section('Light'))!.items).toEqual([
      { label: 'Color', value: 'Color(1, 1, 1, 1)' },
      { label: 'Energy', value: '1.00' },
    ]);
  });

  it('lists no shadow mode row when the file sets none', async () => {
    expect((await section('Shadows'))!.items).toEqual([{ label: 'Enabled', value: 'No' }]);
  });

  it('names each directional_shadow_mode, and an unknown one by its number', async () => {
    const modeLabel = async (mode: string) =>
      (await section('Shadows', { directional_shadow_mode: mode }))!.items.find(
        (i) => i.label === 'Shadow Mode'
      )!.value;

    expect(await modeLabel('0')).toBe('ORTHOGONAL');
    expect(await modeLabel('1')).toBe('PARALLEL_2_SPLITS');
    expect(await modeLabel('2')).toBe('PARALLEL_4_SPLITS');
    expect(await modeLabel('9')).toBe('Unknown (9)');
  });

  it('lists Max Distance and Normal Bias the file sets, after Shadow Mode', async () => {
    const shadows = await section('Shadows', {
      shadow_enabled: 'true',
      shadow_bias: '0.05',
      shadow_normal_bias: '0.02',
      directional_shadow_mode: '1',
      directional_shadow_max_distance: '150.5',
    });
    expect(shadows!.items).toEqual([
      { label: 'Enabled', value: 'Yes' },
      { label: 'Bias', value: '0.050' },
      { label: 'Normal Bias', value: '0.020' },
      { label: 'Shadow Mode', value: 'PARALLEL_2_SPLITS' },
      { label: 'Max Distance', value: '150.50' },
    ]);
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
