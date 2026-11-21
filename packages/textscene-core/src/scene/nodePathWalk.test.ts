import { describe, expect, it } from 'vitest';
import { liveNodePathOf, ROOT_WINDOW_PATH } from './nodePathWalk';

describe('liveNodePathOf', () => {
  it('drops the root window from the absolute path of a scene node', () => {
    expect(liveNodePathOf('/root/Main/Box')).toBe('Main/Box');
  });

  it('gives null for no path', () => {
    expect(liveNodePathOf(undefined)).toBeNull();
  });

  it('gives null for the root window, which no canvas node stands for', () => {
    expect(liveNodePathOf(ROOT_WINDOW_PATH)).toBeNull();
  });
});
