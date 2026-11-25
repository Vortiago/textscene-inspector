import { describe, expect, it } from 'vitest';
import { formatMultiMeshInstance2DProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatMultiMeshInstance2DProperties', () => {
  it('lists the paths of the multimesh and the texture', async () => {
    const sections = await sectionsOf(
      formatMultiMeshInstance2DProperties,
      'MultiMeshInstance2D',
      { multimesh: 'SubResource("MultiMesh_1")', texture: 'ExtResource("1_tex")' },
      { ext: { '1_tex': 'Texture2D' }, sub: { MultiMesh_1: 'MultiMesh' } }
    );

    expect(valueOf(sections, 'MultiMesh')).toBe(`${SCENE_PATH}::MultiMesh_1`);
    expect(valueOf(sections, 'Texture')).toBe('res://1_tex');
  });

  it('names an empty slot as none', async () => {
    const sections = await sectionsOf(formatMultiMeshInstance2DProperties, 'MultiMeshInstance2D');

    expect(valueOf(sections, 'MultiMesh')).toBe('(none)');
    expect(valueOf(sections, 'Texture')).toBe('(none)');
  });
});
