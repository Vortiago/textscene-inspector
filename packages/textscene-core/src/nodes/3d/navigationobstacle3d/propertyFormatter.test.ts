import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import type { PropertySection } from '../../../core/NodeRegistry';
import { parseNavigationObstacle3D } from './parser';
import { formatNavigationObstacle3DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'MovementObstacle', type: 'NavigationObstacle3D' },
};

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatNavigationObstacle3DProperties', () => {
  it('renders the Godot defaults when properties are absent (happy path)', () => {
    const sections = formatNavigationObstacle3DProperties(parseNavigationObstacle3D(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('NavigationObstacle3D');
    expect(valueOf(sections, 'Radius')).toBe('0.00');
    expect(valueOf(sections, 'Height')).toBe('1.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('true');
    expect(valueOf(sections, 'Affect Navigation Mesh')).toBe('false');
    expect(valueOf(sections, 'Carve Navigation Mesh')).toBe('false');
  });

  it('reflects explicit values (edge case)', () => {
    const sections = formatNavigationObstacle3DProperties(
      parseNavigationObstacle3D(HEADING, {
        radius: '1.5',
        height: '2.0',
        avoidance_enabled: 'false',
        affect_navigation_mesh: 'true',
      })
    );
    expect(valueOf(sections, 'Radius')).toBe('1.50');
    expect(valueOf(sections, 'Height')).toBe('2.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('false');
    expect(valueOf(sections, 'Affect Navigation Mesh')).toBe('true');
  });

  it('appends the shared Node3D sections when a transform is present', () => {
    const sections = formatNavigationObstacle3DProperties(
      parseNavigationObstacle3D(HEADING, {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
      })
    );
    expect(sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Position', 'Rotation (degrees)', 'Scale'])
    );
  });
});
