import { describe, expect, it } from 'vitest';
import { formatNavigationObstacle3DProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatNavigationObstacle3DProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatNavigationObstacle3DProperties, 'NavigationObstacle3D');
    expect(sections.map((s) => s.title)).toContain('NavigationObstacle3D');
    expect(valueOf(sections, 'Radius')).toBe('0.00');
    expect(valueOf(sections, 'Height')).toBe('1.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('true');
    expect(valueOf(sections, 'Affect Navigation Mesh')).toBe('false');
    expect(valueOf(sections, 'Carve Navigation Mesh')).toBe('false');
  });

  it('lists the values the file sets', async () => {
    const sections = await sectionsOf(formatNavigationObstacle3DProperties, 'NavigationObstacle3D', {
      radius: '1.5',
      height: '2.0',
      avoidance_enabled: 'false',
      affect_navigation_mesh: 'true',
    });
    expect(valueOf(sections, 'Radius')).toBe('1.50');
    expect(valueOf(sections, 'Height')).toBe('2.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('false');
    expect(valueOf(sections, 'Affect Navigation Mesh')).toBe('true');
  });

  it('appends the Node3D transform sections when the file sets a transform', async () => {
    const sections = await sectionsOf(formatNavigationObstacle3DProperties, 'NavigationObstacle3D', {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
    });
    expect(sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Position', 'Rotation (degrees)', 'Scale'])
    );
  });

  it('lists no transform section when the file sets no transform', async () => {
    const sections = await sectionsOf(formatNavigationObstacle3DProperties, 'NavigationObstacle3D');
    expect(sections.map((s) => s.title)).not.toContain('Position');
  });
});
