/**
 * Tests for the Decal property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatDecalProperties } from './propertyFormatter';
import { parseDecal } from './parser';
import type { DecalProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): DecalProperties {
  return parseDecal(heading('Decal', { name: 'Decal' }), raw);
}

function section(sections: ReturnType<typeof formatDecalProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatDecalProperties', () => {
  it('shows the Albedo texture as "(none)" and no optional textures by default', () => {
    const textures = section(formatDecalProperties(props()), 'Textures')!;
    expect(textures.items).toEqual([{ label: 'Albedo', value: '(none)' }]);
  });

  it('shows every optional texture reference when set', () => {
    const textures = section(
      formatDecalProperties(
        props({
          texture_albedo: 'ExtResource("1_albedo")',
          texture_normal: 'ExtResource("2_normal")',
          texture_orm: 'ExtResource("3_orm")',
          texture_emission: 'ExtResource("4_emission")',
        })
      ),
      'Textures'
    )!;
    expect(textures.items).toEqual([
      { label: 'Albedo', value: 'ExtResource("1_albedo")' },
      { label: 'Normal', value: 'ExtResource("2_normal")' },
      { label: 'ORM', value: 'ExtResource("3_orm")' },
      { label: 'Emission', value: 'ExtResource("4_emission")' },
    ]);
  });

  it('formats the Projection section with Godot defaults', () => {
    const projection = section(formatDecalProperties(props()), 'Projection')!;
    expect(projection.items).toEqual([
      { label: 'Size', value: '(2, 2, 2)' },
      { label: 'Modulate', value: 'rgba(255, 255, 255, 1.00)' },
      { label: 'Albedo Mix', value: '1.00' },
      { label: 'Normal Fade', value: '0.00' },
      { label: 'Upper Fade', value: '0.30' },
      { label: 'Lower Fade', value: '0.30' },
      { label: 'Cull Mask', value: '0xfffff' },
    ]);
  });

  it('formats custom Projection values, including a non-default cull mask in hex', () => {
    const projection = section(
      formatDecalProperties(
        props({
          size: 'Vector3(4, 1, 4)',
          modulate: 'Color(1, 0, 0, 0.5)',
          albedo_mix: '0.5',
          normal_fade: '0.2',
          upper_fade: '0.1',
          lower_fade: '0.9',
          cull_mask: '255',
        })
      ),
      'Projection'
    )!;
    expect(projection.items).toEqual([
      { label: 'Size', value: '(4, 1, 4)' },
      { label: 'Modulate', value: 'rgba(255, 0, 0, 0.50)' },
      { label: 'Albedo Mix', value: '0.50' },
      { label: 'Normal Fade', value: '0.20' },
      { label: 'Upper Fade', value: '0.10' },
      { label: 'Lower Fade', value: '0.90' },
      { label: 'Cull Mask', value: '0xff' },
    ]);
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatDecalProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 3, 0)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
