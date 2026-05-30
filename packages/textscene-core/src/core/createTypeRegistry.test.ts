import { describe, expect, it } from 'vitest';
import { createTypeRegistry } from './createTypeRegistry';

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
