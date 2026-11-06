import { describe, expect, it, vi } from 'vitest';
import { recentlyRead } from './recentlyRead.js';

describe('recentlyRead', () => {
  it('builds a key once and keeps its value', () => {
    const build = vi.fn((key: string) => ({ key }));
    const read = recentlyRead<string, { key: string }>(2);
    expect(read('a', build)).toBe(read('a', build));
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('keeps a null value as built', () => {
    const build = vi.fn(() => null);
    const read = recentlyRead<string, null>(2);
    read('a', build);
    read('a', build);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('drops the key read least recently at the cap', () => {
    const build = vi.fn((key: string) => key);
    const read = recentlyRead<string, string>(2);
    read('a', build);
    read('b', build);
    read('a', build);
    read('c', build);
    build.mockClear();
    read('a', build);
    read('b', build);
    expect(build.mock.calls).toEqual([['b']]);
  });
});
