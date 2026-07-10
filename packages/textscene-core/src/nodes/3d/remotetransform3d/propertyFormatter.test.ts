import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { valueOf } from '../../../parser/testing/parserKit';
import { parseRemoteTransform3D } from './parser';
import { formatRemoteTransform3DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'PositionSynchronizer', type: 'RemoteTransform3D' },
};

describe('formatRemoteTransform3DProperties', () => {
  it('renders the Godot defaults when properties are absent (happy path)', () => {
    const sections = formatRemoteTransform3DProperties(parseRemoteTransform3D(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('RemoteTransform3D');
    expect(valueOf(sections, 'Remote Path')).toBe('(none)');
    expect(valueOf(sections, 'Update Position')).toBe('true');
    expect(valueOf(sections, 'Update Rotation')).toBe('true');
    expect(valueOf(sections, 'Update Scale')).toBe('true');
    expect(valueOf(sections, 'Use Global Coordinates')).toBe('true');
  });

  it('extracts the inner path from a NodePath literal (edge case)', () => {
    const sections = formatRemoteTransform3DProperties(
      parseRemoteTransform3D(HEADING, {
        remote_path: 'NodePath("../DetachTransform/Geometry")',
        update_scale: 'false',
      })
    );
    expect(valueOf(sections, 'Remote Path')).toBe('../DetachTransform/Geometry');
    expect(valueOf(sections, 'Update Scale')).toBe('false');
  });
});
