/**
 * Tests for the MeshInstance3D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatMeshInstance3DProperties } from './propertyFormatter';
import { parseMeshInstance3D } from './parser';
import type { MeshInstance3DProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): MeshInstance3DProperties {
  return parseMeshInstance3D(heading('MeshInstance3D', { name: 'Mesh' }), raw);
}

function section(sections: ReturnType<typeof formatMeshInstance3DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatMeshInstance3DProperties', () => {
  it('omits the Mesh section entirely when no mesh/shadow/skeleton/skin properties are set', () => {
    const sections = formatMeshInstance3DProperties(props());
    expect(section(sections, 'Mesh')).toBeUndefined();
  });

  it('shows the mesh reference when set', () => {
    const mesh = section(
      formatMeshInstance3DProperties(props({ mesh: 'SubResource("BoxMesh_1")' })),
      'Mesh'
    )!;
    expect(mesh.items).toEqual([{ label: 'Mesh', value: 'SubResource("BoxMesh_1")' }]);
  });

  it('maps every cast_shadow value to its label, including an unknown value', () => {
    const labelFor = (castShadow: string) =>
      section(formatMeshInstance3DProperties(props({ mesh: 'x', cast_shadow: castShadow })), 'Mesh')!
        .items.find((i) => i.label === 'Cast Shadow')!.value;

    expect(labelFor('0')).toBe('OFF');
    expect(labelFor('1')).toBe('ON');
    expect(labelFor('2')).toBe('DOUBLE_SIDED');
    expect(labelFor('3')).toBe('SHADOWS_ONLY');
    expect(labelFor('9')).toBe('Unknown (9)');
  });

  it('shows skeleton and skin paths when set', () => {
    const mesh = section(
      formatMeshInstance3DProperties(
        props({ mesh: 'x', skeleton: '../Skeleton3D', skin: 'SubResource("Skin_1")' })
      ),
      'Mesh'
    )!;
    expect(mesh.items).toContainEqual({ label: 'Skeleton', value: '../Skeleton3D' });
    expect(mesh.items).toContainEqual({ label: 'Skin', value: 'SubResource("Skin_1")' });
  });

  it('omits the Material Overrides section when no surface_material_override/N properties are set', () => {
    const sections = formatMeshInstance3DProperties(props());
    expect(section(sections, 'Material Overrides')).toBeUndefined();
  });

  it('lists each surface_material_override/N indexed and ordered by insertion (Map iteration)', () => {
    const overrides = section(
      formatMeshInstance3DProperties(
        props({
          'surface_material_override/0': 'ExtResource("1_mat")',
          'surface_material_override/2': 'ExtResource("2_mat")',
        })
      ),
      'Material Overrides'
    )!;
    expect(overrides.items).toEqual([
      { label: 'Surface 0', value: 'ExtResource("1_mat")' },
      { label: 'Surface 2', value: 'ExtResource("2_mat")' },
    ]);
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatMeshInstance3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 5, 6)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Rotation (degrees)')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
