import { describe, expect, it } from 'vitest';
import { describePendingWork, hasPendingWork, totalPendingWork } from './sceneWork';

const NO_WORK = { resources: 0, textures: 0, fonts: 0 };

describe('pending scene work', () => {
  it('sums every kind of work', () => {
    expect(totalPendingWork({ resources: 2, textures: 1, fonts: 3 })).toBe(6);
  });

  it('has work while any kind is pending, and none at zero', () => {
    expect(hasPendingWork({ ...NO_WORK, fonts: 1 })).toBe(true);
    expect(hasPendingWork(NO_WORK)).toBe(false);
  });

  it('names each pending kind with its count, joined with "and"', () => {
    expect(describePendingWork({ resources: 2, textures: 1, fonts: 0 })).toBe('2 resources and 1 texture');
    expect(describePendingWork({ resources: 1, textures: 2, fonts: 1 })).toBe(
      '1 resource, 2 textures and 1 font'
    );
  });

  it('describes no work as an empty text', () => {
    expect(describePendingWork(NO_WORK)).toBe('');
  });
});
