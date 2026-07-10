/**
 * Tests for the DirectionalLight3D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatDirectionalLight3DProperties } from './propertyFormatter';
import { parseDirectionalLight3D } from './parser';
import type { DirectionalLight3DProperties } from './types';
import { heading } from '../../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): DirectionalLight3DProperties {
  return parseDirectionalLight3D(heading('DirectionalLight3D', { name: 'Sun' }), raw);
}

function section(
  sections: ReturnType<typeof formatDirectionalLight3DProperties>,
  title: string
) {
  return sections.find((s) => s.title === title);
}

describe('formatDirectionalLight3DProperties', () => {
  it('formats the shared base Light section (color, energy)', () => {
    const light = section(formatDirectionalLight3DProperties(props()), 'Light')!;
    expect(light.items).toEqual([
      { label: 'Color', value: 'Color(1, 1, 1, 1)' },
      { label: 'Energy', value: '1.00' },
    ]);
  });

  it('formats the Shadows section without directional items when unset', () => {
    const shadows = section(formatDirectionalLight3DProperties(props()), 'Shadows')!;
    expect(shadows.items).toEqual([{ label: 'Enabled', value: 'No' }]);
  });

  it('maps every directional_shadow_mode value to its label, including an unknown value', () => {
    const modeLabel = (mode: string) =>
      section(
        formatDirectionalLight3DProperties(props({ directional_shadow_mode: mode })),
        'Shadows'
      )!.items.find((i) => i.label === 'Shadow Mode')!.value;

    expect(modeLabel('0')).toBe('ORTHOGONAL');
    expect(modeLabel('1')).toBe('PARALLEL_2_SPLITS');
    expect(modeLabel('2')).toBe('PARALLEL_4_SPLITS');
    expect(modeLabel('9')).toBe('Unknown (9)');
  });

  it('shows Max Distance and Normal Bias when set, appended after Shadow Mode', () => {
    const shadows = section(
      formatDirectionalLight3DProperties(
        props({
          shadow_enabled: 'true',
          shadow_bias: '0.05',
          shadow_normal_bias: '0.02',
          directional_shadow_mode: '1',
          directional_shadow_max_distance: '150.5',
        })
      ),
      'Shadows'
    )!;
    expect(shadows.items).toEqual([
      { label: 'Enabled', value: 'Yes' },
      { label: 'Bias', value: '0.050' },
      { label: 'Normal Bias', value: '0.020' },
      { label: 'Shadow Mode', value: 'PARALLEL_2_SPLITS' },
      { label: 'Max Distance', value: '150.50' },
    ]);
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatDirectionalLight3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
