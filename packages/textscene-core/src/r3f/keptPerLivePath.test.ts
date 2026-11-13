import { describe, expect, it } from 'vitest';
import { keptPerLivePath } from './keptPerLivePath';

describe('keptPerLivePath', () => {
  it('gives the value a node had at the path while the next one equals it', () => {
    const kept = keptPerLivePath<{ bones: string[] }>();
    const node = {};
    const first = kept(node, 'Root/A', { bones: ['A'] });
    expect(kept(node, 'Root/A', { bones: ['A'] })).toBe(first);
  });

  it('gives the new value once it differs, and keeps that one', () => {
    const kept = keptPerLivePath<{ bones: string[] }>();
    const node = {};
    kept(node, 'Root/A', { bones: ['A'] });
    const changed = kept(node, 'Root/A', { bones: ['A', 'B'] });
    expect(changed).toEqual({ bones: ['A', 'B'] });
    expect(kept(node, 'Root/A', { bones: ['A', 'B'] })).toBe(changed);
  });

  it('keeps one value for each live path of a shared node', () => {
    const kept = keptPerLivePath<{ index: number }>();
    const node = {};
    const first = kept(node, 'Root/One/A', { index: 0 });
    const second = kept(node, 'Root/Two/A', { index: 0 });
    expect(second).not.toBe(first);
  });

  it('compares with the function it is given', () => {
    const kept = keptPerLivePath<{ id: number; note: string }>((a, b) => a.id === b.id);
    const node = {};
    const first = kept(node, 'Root/A', { id: 1, note: 'first' });
    expect(kept(node, 'Root/A', { id: 1, note: 'second' })).toBe(first);
  });
});
