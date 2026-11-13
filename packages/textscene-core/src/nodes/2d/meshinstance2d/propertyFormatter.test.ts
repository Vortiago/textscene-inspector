import { describe, expect, it } from 'vitest';
import { heading, valueOf } from '../../../parser/testing/parserKit';
import { parseMeshInstance2D } from './parser';
import { formatMeshInstance2DProperties } from './propertyFormatter';

describe('formatMeshInstance2DProperties', () => {
  it('lists the mesh and texture references', () => {
    const sections = formatMeshInstance2DProperties(
      parseMeshInstance2D(heading('MeshInstance2D', { name: 'M' }), {
        mesh: 'SubResource("QuadMesh_1")',
        texture: 'ExtResource("1_tex")',
      })
    );

    expect(valueOf(sections, 'Mesh')).toBe('SubResource("QuadMesh_1")');
    expect(valueOf(sections, 'Texture')).toBe('ExtResource("1_tex")');
  });

  it('names an empty slot as none', () => {
    const sections = formatMeshInstance2DProperties(parseMeshInstance2D(heading('MeshInstance2D'), {}));

    expect(valueOf(sections, 'Mesh')).toBe('(none)');
    expect(valueOf(sections, 'Texture')).toBe('(none)');
  });
});
