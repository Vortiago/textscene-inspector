import { describe, expect, it, vi } from 'vitest';
import type { RawNode } from '../parser/types.js';
import { perTree } from './perTree.js';

describe('perTree', () => {
  it('builds once for each roots array', () => {
    const build = vi.fn((roots: readonly RawNode[]) => roots.length);
    const read = perTree(build);
    const roots: RawNode[] = [];
    read(roots);
    read(roots);
    read([]);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('keeps an undefined table as built', () => {
    const build = vi.fn(() => undefined);
    const read = perTree(build);
    const roots: RawNode[] = [];
    read(roots);
    expect(read(roots)).toBeUndefined();
    expect(build).toHaveBeenCalledTimes(1);
  });
});
