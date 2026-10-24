import { describe, expect, it, vi } from 'vitest';
import { perObject } from './perObject.js';

describe('perObject', () => {
  it('builds once for each key', () => {
    const build = vi.fn((key: object) => ({ key }));
    const read = perObject(build);
    const key = {};
    expect(read(key)).toBe(read(key));
    read({});
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('passes the key to the build', () => {
    const read = perObject((key: { readonly size: number }) => key.size * 2);
    expect(read({ size: 3 })).toBe(6);
  });

  it('keeps an undefined value as built (edge case)', () => {
    const build = vi.fn(() => undefined);
    const read = perObject(build);
    const key = {};
    read(key);
    expect(read(key)).toBeUndefined();
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('builds again on the next ask when the build throws (error case)', () => {
    const build = vi.fn<(key: object) => object>().mockImplementationOnce(() => {
      throw new Error('lost context');
    });
    build.mockImplementation(() => ({}));
    const read = perObject(build);
    const key = {};
    expect(() => read(key)).toThrow('lost context');
    expect(read(key)).toEqual({});
  });
});
