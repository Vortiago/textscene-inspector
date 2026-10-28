import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseSkeleton3D } from './parser';

describe('parseSkeleton3D', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseSkeleton3D(heading('Skeleton3D', { name: 'MySkeleton3D', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });
    expect(result.name).toBe('MySkeleton3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform', () => {
    const result = parseSkeleton3D(heading('Skeleton3D', { name: 'BadSkeleton' }), {
      transform: 'Transform3D(bad)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes', () => {
    const result = parseSkeleton3D(heading('Skeleton3D', { name: '' }), {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('reads the bone table from the bones keys', () => {
    const result = parseSkeleton3D(heading('Skeleton3D', { name: 'S' }), {
      'bones/0/name': '"hip"',
      'bones/1/name': '"knee"',
      'bones/1/parent': '0',
    });

    expect(result.bones.map((bone) => [bone.name, bone.parent])).toEqual([
      ['hip', -1],
      ['knee', 0],
    ]);
  });

  it('reads show_rest_only, false when absent or malformed (edge case)', () => {
    expect(
      parseSkeleton3D(heading('Skeleton3D', { name: 'S' }), { show_rest_only: 'true' }).showRestOnly
    ).toBe(true);
    expect(parseSkeleton3D(heading('Skeleton3D', { name: 'S' }), {}).showRestOnly).toBe(false);
    expect(
      parseSkeleton3D(heading('Skeleton3D', { name: 'S' }), { show_rest_only: 'maybe' }).showRestOnly
    ).toBe(false);
  });
});
