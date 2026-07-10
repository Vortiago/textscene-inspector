import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { valueOf } from '../../../parser/testing/parserKit';
import { parseNavigationAgent3D } from './parser';
import { formatNavigationAgent3DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = { type: 'node', attributes: { name: 'Movement', type: 'NavigationAgent3D' } };

describe('formatNavigationAgent3DProperties', () => {
  it('renders the Godot defaults when properties are absent (happy path)', () => {
    const sections = formatNavigationAgent3DProperties(parseNavigationAgent3D(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('NavigationAgent3D');
    expect(valueOf(sections, 'Radius')).toBe('0.50');
    expect(valueOf(sections, 'Height')).toBe('1.00');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('false');
    expect(valueOf(sections, 'Max Neighbors')).toBe('10');
    expect(valueOf(sections, 'Max Speed')).toBe('10.00');
  });

  it('reflects explicit values (edge case)', () => {
    const sections = formatNavigationAgent3DProperties(
      parseNavigationAgent3D(HEADING, {
        radius: '0.75',
        height: '1.8',
        avoidance_enabled: 'true',
        max_neighbors: '1',
        max_speed: '5',
      })
    );
    expect(valueOf(sections, 'Radius')).toBe('0.75');
    expect(valueOf(sections, 'Height')).toBe('1.80');
    expect(valueOf(sections, 'Avoidance Enabled')).toBe('true');
    expect(valueOf(sections, 'Max Neighbors')).toBe('1');
    expect(valueOf(sections, 'Max Speed')).toBe('5.00');
  });
});
