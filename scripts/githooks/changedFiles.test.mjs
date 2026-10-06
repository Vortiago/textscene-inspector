import { describe, expect, it } from 'vitest';
import { parseNameStatus } from './changedFiles.mjs';

describe('parseNameStatus', () => {
  it('splits the added and modified paths from the deleted ones', () => {
    expect(parseNameStatus('A\tsrc/new.ts\nM\tREADME.md\nD\tsrc/old.ts')).toEqual({
      changed: ['src/new.ts', 'README.md'],
      deleted: ['src/old.ts'],
    });
  });

  it('returns no paths for empty output', () => {
    expect(parseNameStatus('')).toEqual({ changed: [], deleted: [] });
  });

  it('keeps a path that holds a space', () => {
    expect(parseNameStatus('M\tdocs/a b.md')).toEqual({ changed: ['docs/a b.md'], deleted: [] });
  });
});
