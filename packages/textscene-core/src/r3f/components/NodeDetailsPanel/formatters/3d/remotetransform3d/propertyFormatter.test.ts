import { describe, expect, it } from 'vitest';
import { formatRemoteTransform3DProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatRemoteTransform3DProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatRemoteTransform3DProperties, 'RemoteTransform3D');
    expect(sections.map((s) => s.title)).toContain('RemoteTransform3D');
    expect(valueOf(sections, 'Remote Path')).toBe('(none)');
    expect(valueOf(sections, 'Update Position')).toBe('true');
    expect(valueOf(sections, 'Update Rotation')).toBe('true');
    expect(valueOf(sections, 'Update Scale')).toBe('true');
    expect(valueOf(sections, 'Use Global Coordinates')).toBe('true');
  });

  it('lists the path a NodePath holds', async () => {
    const sections = await sectionsOf(formatRemoteTransform3DProperties, 'RemoteTransform3D', {
      remote_path: 'NodePath("../Target/Geometry")',
      update_rotation: 'false',
    });
    expect(valueOf(sections, 'Remote Path')).toBe('../Target/Geometry');
    expect(valueOf(sections, 'Update Rotation')).toBe('false');
  });
});
