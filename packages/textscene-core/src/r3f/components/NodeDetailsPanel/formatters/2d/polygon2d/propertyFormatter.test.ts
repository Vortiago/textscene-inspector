import { describe, expect, it } from 'vitest';
import { formatPolygon2DProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, sectionTitled, valueOf } from '../../testing/inspectedScene';

describe('formatPolygon2DProperties', () => {
  it('lists the vertex count, colour and texture path in a Polygon section', async () => {
    const sections = await sectionsOf(
      formatPolygon2DProperties,
      'Polygon2D',
      {
        polygon: 'PackedVector2Array(0, 0, 1, 0, 1, 1, 0, 1)',
        color: 'Color(0.5, 0.25, 0.75, 1)',
        texture: 'SubResource("8")',
      },
      { sub: { '8': 'Texture2D' } }
    );
    expect(valueOf(sections, 'Vertices')).toBe('4');
    expect(valueOf(sections, 'Texture')).toBe(`${SCENE_PATH}::8`);
    expect(valueOf(sections, 'Color')).toContain('0.5');
  });

  it('names a missing texture as none and appends the Node2D sections', async () => {
    const sections = await sectionsOf(formatPolygon2DProperties, 'Polygon2D', {
      polygon: 'PackedVector2Array(0, 0, 1, 0, 1, 1)',
    });
    expect(valueOf(sections, 'Texture')).toBe('(none)');
    expect(sectionTitled(sections, 'Position')).toBeDefined();
  });
});
