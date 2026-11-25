import { describe, expect, it } from 'vitest';
import { formatMeshInstance2DProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatMeshInstance2DProperties', () => {
  it('lists the paths of the mesh and the texture', async () => {
    const sections = await sectionsOf(
      formatMeshInstance2DProperties,
      'MeshInstance2D',
      { mesh: 'SubResource("QuadMesh_1")', texture: 'ExtResource("1_tex")' },
      { ext: { '1_tex': 'Texture2D' }, sub: { QuadMesh_1: 'QuadMesh' } }
    );

    expect(valueOf(sections, 'Mesh')).toBe(`${SCENE_PATH}::QuadMesh_1`);
    expect(valueOf(sections, 'Texture')).toBe('res://1_tex');
  });

  it('names an empty slot as none', async () => {
    const sections = await sectionsOf(formatMeshInstance2DProperties, 'MeshInstance2D');

    expect(valueOf(sections, 'Mesh')).toBe('(none)');
    expect(valueOf(sections, 'Texture')).toBe('(none)');
  });
});
