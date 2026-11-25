import { describe, it, expect } from 'vitest';
import { formatNode3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

async function axes(title: string, transform: string): Promise<string[]> {
  const sections = await sectionsOf(formatNode3DProperties, 'Node3D', { transform });
  return sectionTitled(sections, title)!.items.map((item) => item.value);
}

describe('formatNode3DProperties', () => {
  it("lists the rotation Godot's rotation_degrees answers for the decal-filter light (measured)", async () => {
    const transform =
      'Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 5, 0)';
    expect(await axes('Rotation (degrees)', transform)).toEqual(['-30.00', '30.00', '0.00']);
    expect(await axes('Position', transform)).toEqual(['0.000', '5.000', '0.000']);
  });

  it('lists the negative scale Godot answers for a mirrored basis', async () => {
    expect(await axes('Scale', 'Transform3D(-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0)')).toEqual([
      '-1.000',
      '-1.000',
      '-1.000',
    ]);
  });

  it('lists no transform section when the file sets no transform', async () => {
    const sections = await sectionsOf(formatNode3DProperties, 'Node3D', { visible: 'false' });
    expect(sections.map((section) => section.title)).not.toContain('Position');
  });
});
