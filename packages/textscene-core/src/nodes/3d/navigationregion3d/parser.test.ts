import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNavigationRegion3D } from './parser';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseNavigationRegion3D', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseNavigationRegion3D(
      heading({ name: 'MyNavigationRegion3D', type: 'NavigationRegion3D', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyNavigationRegion3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseNavigationRegion3D(
      heading({ name: 'Bad', type: 'NavigationRegion3D' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseNavigationRegion3D(heading({}), {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
