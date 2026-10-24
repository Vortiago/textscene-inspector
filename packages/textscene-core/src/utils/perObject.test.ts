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

  it('builds again on the next ask for a value the keep rule refuses', () => {
    let next = 0;
    const build = vi.fn(() => next++);
    const read = perObject(build, { keeps: (value) => value >= 2 });
    const key = {};
    expect([read(key), read(key), read(key), read(key)]).toEqual([0, 1, 2, 2]);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it('hands the keep rule the built value and its key', () => {
    const keeps = vi.fn(() => true);
    const key = { size: 3 };
    perObject((k: { size: number }) => k.size * 2, { keeps })(key);
    expect(keeps).toHaveBeenCalledWith(6, key);
  });

  it('returns a refused value to the one that asked (edge case)', () => {
    const read = perObject(() => 'draft', { keeps: () => false });
    expect(read({})).toBe('draft');
  });
});
