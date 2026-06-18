import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNavigationRegion2D } from './parser';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseNavigationRegion2D', () => {
  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parseNavigationRegion2D(
      heading({ name: 'MyNavigationRegion2D', type: 'NavigationRegion2D', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.name).toBe('MyNavigationRegion2D');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parseNavigationRegion2D(
      heading({ name: 'Bad', type: 'NavigationRegion2D' }),
      { transform: 'Transform2D(not, valid)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseNavigationRegion2D(heading({}), {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });
});
