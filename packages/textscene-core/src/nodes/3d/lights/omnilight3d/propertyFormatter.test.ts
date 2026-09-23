/** OmniLight3D property formatter. */

import { describe, it, expect } from 'vitest';
import { formatOmniLight3DProperties } from './propertyFormatter';
import { parseOmniLight3D } from './parser';
import type { OmniLight3DProperties } from './types';
import { heading } from '../../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): OmniLight3DProperties {
  return parseOmniLight3D(heading('OmniLight3D', { name: 'Point' }), raw);
}

function section(sections: ReturnType<typeof formatOmniLight3DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatOmniLight3DProperties', () => {
  it('formats the Light section with base items plus Range and Attenuation', () => {
    const light = section(formatOmniLight3DProperties(props()), 'Light')!;
    expect(light.items).toEqual([
      { label: 'Color', value: 'Color(1, 1, 1, 1)' },
      { label: 'Energy', value: '1.00' },
      { label: 'Range', value: '5.00' },
      { label: 'Attenuation', value: '1.00' },
    ]);
  });

  it('formats custom range and attenuation', () => {
    const light = section(
      formatOmniLight3DProperties(props({ omni_range: '12.5', omni_attenuation: '2.25' })),
      'Light'
    )!;
    expect(light.items).toContainEqual({ label: 'Range', value: '12.50' });
    expect(light.items).toContainEqual({ label: 'Attenuation', value: '2.25' });
  });

  it('formats the Shadows section without omni items when shadow mode unset', () => {
    const shadows = section(formatOmniLight3DProperties(props()), 'Shadows')!;
    expect(shadows.items).toEqual([{ label: 'Enabled', value: 'No' }]);
  });

  it('maps every omni_shadow_mode value to its label, including an unknown value', () => {
    const modeLabel = (mode: string) =>
      section(
        formatOmniLight3DProperties(props({ omni_shadow_mode: mode })),
        'Shadows'
      )!.items.find((i) => i.label === 'Shadow Mode')!.value;

    expect(modeLabel('0')).toBe('DUAL_PARABOLOID');
    expect(modeLabel('1')).toBe('CUBE');
    expect(modeLabel('7')).toBe('Unknown (7)');
  });

  it('shows Normal Bias and Shadow Mode together when both set', () => {
    const shadows = section(
      formatOmniLight3DProperties(
        props({ shadow_enabled: 'true', shadow_normal_bias: '0.03', omni_shadow_mode: '1' })
      ),
      'Shadows'
    )!;
    expect(shadows.items).toEqual([
      { label: 'Enabled', value: 'Yes' },
      { label: 'Normal Bias', value: '0.030' },
      { label: 'Shadow Mode', value: 'CUBE' },
    ]);
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatOmniLight3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
