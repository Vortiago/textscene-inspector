import { describe, expect, it } from 'vitest';
import { heading, valueOf } from '../../../parser/testing/parserKit';
import { parseMultiMeshInstance2D } from './parser';
import { formatMultiMeshInstance2DProperties } from './propertyFormatter';

describe('formatMultiMeshInstance2DProperties', () => {
  it('lists the multimesh and texture references', () => {
    const sections = formatMultiMeshInstance2DProperties(
      parseMultiMeshInstance2D(heading('MultiMeshInstance2D', { name: 'M' }), {
        multimesh: 'SubResource("MultiMesh_1")',
        texture: 'ExtResource("1_tex")',
      })
    );

    expect(valueOf(sections, 'MultiMesh')).toBe('SubResource("MultiMesh_1")');
    expect(valueOf(sections, 'Texture')).toBe('ExtResource("1_tex")');
  });

  it('names an empty slot as none', () => {
    const sections = formatMultiMeshInstance2DProperties(
      parseMultiMeshInstance2D(heading('MultiMeshInstance2D'), {})
    );

    expect(valueOf(sections, 'MultiMesh')).toBe('(none)');
    expect(valueOf(sections, 'Texture')).toBe('(none)');
  });
});
