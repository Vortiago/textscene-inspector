import { describe, expect, it } from 'vitest';
import { boneKeyOf } from './boneTable';

describe('boneKeyOf', () => {
  it('reads the bone slot and the leaf of a bone key', () => {
    expect(boneKeyOf('bones/3/rest')).toEqual({ indexText: '3', which: 3, leaf: 'rest' });
  });

  it('decides the leaf by its first segment, as `_set` reads slice 2 alone (skeleton_3d.cpp:83)', () => {
    expect(boneKeyOf('bones/0/position/x')?.leaf).toBe('position');
  });

  it('stores the index as `uint32_t which` does, so -1 wraps (skeleton_3d.cpp:82)', () => {
    expect(boneKeyOf('bones/-1/name')).toEqual({ indexText: '-1', which: 4294967295, leaf: 'name' });
  });

  it('is null for a key that is no bone key', () => {
    expect(boneKeyOf('bone_count')).toBeNull();
  });
});
