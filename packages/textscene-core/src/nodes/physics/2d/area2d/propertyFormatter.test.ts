import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import type { PropertySection } from '../../../../core/NodeRegistry';
import { parseArea2D } from './parser';
import { formatArea2DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Trigger', type: 'Area2D' },
};

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatArea2DProperties', () => {
  it('shows monitoring/monitorable/layer/mask when explicitly set (happy path)', () => {
    const sections = formatArea2DProperties(
      parseArea2D(HEADING, { monitoring: 'true', monitorable: 'false', collision_layer: '4', collision_mask: '1' })
    );
    expect(sections.map((s) => s.title)).toContain('Area2D');
    expect(valueOf(sections, 'Monitoring')).toBe('true');
    expect(valueOf(sections, 'Monitorable')).toBe('false');
    expect(valueOf(sections, 'Collision Layer')).toBe('4');
    expect(valueOf(sections, 'Collision Mask')).toBe('1');
  });

  it('falls back to Godot defaults when absent (edge case)', () => {
    const sections = formatArea2DProperties(parseArea2D(HEADING, {}));
    expect(valueOf(sections, 'Monitoring')).toBe('true');
    expect(valueOf(sections, 'Monitorable')).toBe('true');
    expect(valueOf(sections, 'Collision Layer')).toBe('1');
    expect(valueOf(sections, 'Collision Mask')).toBe('1');
  });

  it('appends the shared Node2D sections (Position, Rotation, Scale)', () => {
    const sections = formatArea2DProperties(parseArea2D(HEADING, {}));
    expect(sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Position', 'Rotation (degrees)', 'Scale'])
    );
  });
});
