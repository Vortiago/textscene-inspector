import { describe, expect, it } from 'vitest';
import { formatArea2DProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../../testing/inspectedScene';

describe('formatArea2DProperties', () => {
  it('lists the monitoring, layer and mask the file sets', async () => {
    const sections = await sectionsOf(formatArea2DProperties, 'Area2D', {
      monitoring: 'true',
      monitorable: 'false',
      collision_layer: '4',
      collision_mask: '1',
    });
    expect(sections.map((s) => s.title)).toContain('Area2D');
    expect(valueOf(sections, 'Monitoring')).toBe('true');
    expect(valueOf(sections, 'Monitorable')).toBe('false');
    expect(valueOf(sections, 'Collision Layer')).toBe('4');
    expect(valueOf(sections, 'Collision Mask')).toBe('1');
  });

  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatArea2DProperties, 'Area2D');
    expect(valueOf(sections, 'Monitoring')).toBe('true');
    expect(valueOf(sections, 'Monitorable')).toBe('true');
    expect(valueOf(sections, 'Collision Layer')).toBe('1');
    expect(valueOf(sections, 'Collision Mask')).toBe('1');
  });

  it('appends the Node2D sections', async () => {
    const sections = await sectionsOf(formatArea2DProperties, 'Area2D');
    expect(sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Position', 'Rotation (degrees)', 'Scale'])
    );
  });
});
