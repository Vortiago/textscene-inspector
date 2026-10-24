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

  it('builds again when the key stamp moves', () => {
    const build = vi.fn((key: { version: number }) => ({ builtAt: key.version }));
    const read = perObject(build, { stamp: ({ version }) => version });
    const key = { version: 1 };
    const first = read(key);
    key.version = 2;
    expect(read(key)).not.toBe(first);
    expect(read(key)).toEqual({ builtAt: 2 });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('does not build again while the key stamp holds', () => {
    const build = vi.fn((key: { version: number }) => ({ key }));
    const read = perObject(build, { stamp: ({ version }) => version });
    const key = { version: 1 };
    expect(read(key)).toBe(read(key));
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('keeps an undefined value while the key stamp holds (edge case)', () => {
    const build = vi.fn((_key: { version: number }) => undefined);
    const read = perObject(build, { stamp: ({ version }) => version });
    const key = { version: 1 };
    read(key);
    expect(read(key)).toBeUndefined();
    expect(build).toHaveBeenCalledTimes(1);
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

  it('checks the stamp on a hit and the keep rule on a store, together', () => {
    const key = { version: 1 };
    const keeps = vi.fn((value: number) => value >= 10);
    const build = vi.fn((versioned: { version: number }) => versioned.version * 10);
    const read = perObject(build, { keeps, stamp: ({ version }) => version });
    expect([read(key), read(key)]).toEqual([10, 10]);
    key.version = 2;
    expect([read(key), read(key)]).toEqual([20, 20]);
    expect(build).toHaveBeenCalledTimes(2);
    expect(keeps).toHaveBeenCalledTimes(2);
  });
});
