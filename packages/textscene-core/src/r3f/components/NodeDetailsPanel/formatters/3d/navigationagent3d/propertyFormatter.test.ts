import { describe, expect, it } from 'vitest';
import { formatNavigationAgent3DProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatNavigationAgent3DProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatNavigationAgent3DProperties, 'NavigationAgent3D');
    expect(sections.map((s) => s.title)).toContain('NavigationAgent3D');
    expect(valueOf(sections, 'Radius')).toBe('0.50');
    expect(valueOf(sections, 'Height')).toBe('1.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('false');
    expect(valueOf(sections, 'Max Neighbors')).toBe('10');
    expect(valueOf(sections, 'Max Speed')).toBe('10.00');
  });

  it('lists the values the file sets', async () => {
    const sections = await sectionsOf(formatNavigationAgent3DProperties, 'NavigationAgent3D', {
      radius: '0.75',
      height: '1.8',
      avoidance_enabled: 'true',
      max_neighbors: '1',
      max_speed: '5',
    });
    expect(valueOf(sections, 'Radius')).toBe('0.75');
    expect(valueOf(sections, 'Height')).toBe('1.80');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('true');
    expect(valueOf(sections, 'Max Neighbors')).toBe('1');
    expect(valueOf(sections, 'Max Speed')).toBe('5.00');
  });
});
