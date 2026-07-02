import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseNode3D } from '../../base/node3d/parser';

describe('parseNode3D (skeleton3d)', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseNode3D(
      heading('Skeleton3D', { name: 'MySkeleton3D', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MySkeleton3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform', () => {
    const result = parseNode3D(heading('Skeleton3D', { name: 'BadSkeleton' }), {
      transform: 'Transform3D(bad)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes', () => {
    const result = parseNode3D(heading('Skeleton3D', { name: '' }), {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
