import { describe, expect, it } from 'vitest';
import { changedEntries } from './gitNameStatus.mjs';

describe('changedEntries', () => {
  it('names each entry added, changed or removed', () => {
    expect(changedEntries('A\tsrc/new.ts\nM\tREADME.md\nD\tsrc/old.ts')).toEqual([
      { change: 'added', path: 'src/new.ts' },
      { change: 'changed', path: 'README.md' },
      { change: 'removed', path: 'src/old.ts' },
    ]);
  });

  it('reads a type change as changed (edge case)', () => {
    expect(changedEntries('T\tscripts/link.mjs')).toEqual([{ change: 'changed', path: 'scripts/link.mjs' }]);
  });

  it('gives no entry for empty output (edge case)', () => {
    expect(changedEntries('')).toEqual([]);
  });
});
