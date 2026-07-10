import { describe, expect, it, vi } from 'vitest';
import { createTypeRegistry } from './createTypeRegistry';
import * as logger from '../logger';

describe('createTypeRegistry', () => {
  it('registers and retrieves values by type name', () => {
    const reg = createTypeRegistry<number>();
    reg.register('A', 1);
    reg.register('B', 2);
    expect(reg.get('A')).toBe(1);
    expect(reg.get('B')).toBe(2);
  });

  it('returns undefined for unknown type names', () => {
    const reg = createTypeRegistry<number>();
    expect(reg.get('missing')).toBeUndefined();
    expect(reg.has('missing')).toBe(false);
  });

  it('silently overwrites a duplicate registration (HMR-friendly)', () => {
    const reg = createTypeRegistry<number>();
    reg.register('A', 1);
    reg.register('A', 99);
    expect(reg.get('A')).toBe(99);
  });

  it('lists all registered type names', () => {
    const reg = createTypeRegistry<string>();
    reg.register('X', 'x');
    reg.register('Y', 'y');
    expect(reg.getAllTypeNames().sort()).toEqual(['X', 'Y']);
  });

  it('clears all entries', () => {
    const reg = createTypeRegistry<string>();
    reg.register('X', 'x');
    reg.clear();
    expect(reg.getAllTypeNames()).toEqual([]);
  });
});

describe('createTypeRegistry — duplicate-registration warning (#217)', () => {
  it('warns (but still overwrites) on a duplicate typeName — parity with NodeRegistry', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const reg = createTypeRegistry<number>();
    reg.register('A', 1);
    reg.register('A', 99);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toMatch(/already registered/i);
    expect(reg.get('A')).toBe(99);

    warnSpy.mockRestore();
  });

  it('does not warn for two DIFFERENT typeNames', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const reg = createTypeRegistry<number>();
    reg.register('A', 1);
    reg.register('B', 2);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('includes the registry label in the warning when provided', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const reg = createTypeRegistry<number>('MyRegistry');
    reg.register('A', 1);
    reg.register('A', 2);

    expect(warnSpy.mock.calls[0]![0]).toContain('MyRegistry');
    warnSpy.mockRestore();
  });
});
