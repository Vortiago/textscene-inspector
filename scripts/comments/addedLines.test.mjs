import { describe, expect, it } from 'vitest';
import { addedLines } from './addedLines.mjs';

const MODIFIED = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -3 +3,2 @@ function f() {',
  '-old',
  '+new',
  '+newer',
  '@@ -10,2 +11 @@',
  '-gone',
  '-gone too',
  '+kept',
].join('\n');

describe('addedLines', () => {
  it('reads the line numbers of each hunk in the new file', () => {
    expect(addedLines(MODIFIED)).toEqual(new Map([['src/a.ts', new Set([3, 4, 11])]]));
  });

  it('reads no line for a hunk that only deletes', () => {
    const diff = ['--- a/src/a.ts', '+++ b/src/a.ts', '@@ -3,2 +2,0 @@', '-old', '-older'].join('\n');
    expect(addedLines(diff)).toEqual(new Map([['src/a.ts', new Set()]]));
  });

  it('skips a deleted file', () => {
    const diff = ['--- a/src/a.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-old'].join('\n');
    expect(addedLines(diff)).toEqual(new Map());
  });

  it('reads every line of an added file', () => {
    const diff = ['--- /dev/null', '+++ b/src/new.ts', '@@ -0,0 +1,2 @@', '+one', '+two'].join('\n');
    expect(addedLines(diff)).toEqual(new Map([['src/new.ts', new Set([1, 2])]]));
  });

  it('reads nothing from an empty diff', () => {
    expect(addedLines('')).toEqual(new Map());
  });
});
