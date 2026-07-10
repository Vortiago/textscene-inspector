import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import type { PropertySection } from '../../../core/NodeRegistry';
import { parseRemoteTransform2D } from './parser';
import { formatRemoteTransform2DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'CameraAnchor', type: 'RemoteTransform2D' },
};

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatRemoteTransform2DProperties', () => {
  it('renders the Godot defaults when properties are absent (happy path)', () => {
    const sections = formatRemoteTransform2DProperties(parseRemoteTransform2D(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('RemoteTransform2D');
    expect(valueOf(sections, 'Remote Path')).toBe('(none)');
    expect(valueOf(sections, 'Update Position')).toBe('true');
    expect(valueOf(sections, 'Update Rotation')).toBe('true');
    expect(valueOf(sections, 'Update Scale')).toBe('true');
    expect(valueOf(sections, 'Use Global Coordinates')).toBe('true');
  });

  it('extracts the inner path from a NodePath literal (edge case)', () => {
    const sections = formatRemoteTransform2DProperties(
      parseRemoteTransform2D(HEADING, {
        remote_path: 'NodePath("../../Camera2D")',
        update_rotation: 'false',
      })
    );
    expect(valueOf(sections, 'Remote Path')).toBe('../../Camera2D');
    expect(valueOf(sections, 'Update Rotation')).toBe('false');
  });
});
