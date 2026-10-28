import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseSkeletonModifier3D } from './parser';

describe('parseSkeletonModifier3D', () => {
  it('keeps the Node3D parse', () => {
    const result = parseSkeletonModifier3D(heading('SkeletonModifier3D', { name: 'M', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });

    expect(result.name).toBe('M');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('is active at full influence when the file writes neither (`skeleton_modifier_3d.h:90-91`)', () => {
    const result = parseSkeletonModifier3D(heading('SkeletonModifier3D', { name: 'M' }), {});

    expect(result.active).toBe(true);
    expect(result.influence).toBe(1);
  });

  it('reads active and influence', () => {
    const result = parseSkeletonModifier3D(heading('SkeletonModifier3D', { name: 'M' }), {
      active: 'false',
      influence: '0.5',
    });

    expect(result.active).toBe(false);
    expect(result.influence).toBe(0.5);
  });

  it('keeps an influence outside the inspector range, since the setter assigns it (edge case)', () => {
    const result = parseSkeletonModifier3D(heading('SkeletonModifier3D', { name: 'M' }), {
      influence: '2.5',
    });

    expect(result.influence).toBe(2.5);
  });

  it('falls back to the defaults on malformed values (edge case)', () => {
    const result = parseSkeletonModifier3D(heading('SkeletonModifier3D', { name: 'M' }), {
      active: 'maybe',
      influence: 'half',
    });

    expect(result.active).toBe(true);
    expect(result.influence).toBe(1);
  });
});
