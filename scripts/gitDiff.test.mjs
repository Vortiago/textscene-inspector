import { describe, expect, it } from 'vitest';
import { addedLines } from './gitDiff.mjs';

const at = (diff) => addedLines(diff).map(({ path, line }) => `${path}:${line}`);

describe('addedLines', () => {
  it('reads the new line number of each added line, hunk by hunk', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
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
    expect(at(diff)).toEqual(['src/a.ts:3', 'src/a.ts:4', 'src/a.ts:11']);
  });

  it('keeps the text of each added line', () => {
    const diff = ['+++ b/src/a.ts', '@@ -0,0 +1 @@', '+const a = 1;'].join('\n');
    expect(addedLines(diff)).toEqual([{ path: 'src/a.ts', line: 1, text: 'const a = 1;' }]);
  });

  it('reads an added line that starts with ++ as a line, not a file header', () => {
    const diff = ['+++ b/src/a.ts', '@@ -0,0 +1,2 @@', '+++ b/not-a-file', '+two'].join('\n');
    expect(at(diff)).toEqual(['src/a.ts:1', 'src/a.ts:2']);
  });

  it('reads the path of a file whose name holds a space without the tab git ends it with', () => {
    const diff = ['+++ b/src/a b.ts\t', '@@ -0,0 +1 @@', '+const a = 1;'].join('\n');
    expect(at(diff)).toEqual(['src/a b.ts:1']);
  });

  it('reads no line from a hunk that only deletes', () => {
    expect(at(['+++ b/src/a.ts', '@@ -3,2 +2,0 @@', '-old', '-older'].join('\n'))).toEqual([]);
  });

  it('unquotes a path git writes in C style', () => {
    const diff = ['+++ "b/src/a\\"b.ts"', '@@ -0,0 +1 @@', '+one'].join('\n');
    expect(at(diff)).toEqual(['src/a"b.ts:1']);
  });

  it('unquotes octal bytes and keeps an unescaped non-ASCII path', () => {
    const diff = ['+++ "b/\\303\\270 æ.ts"', '@@ -0,0 +1 @@', '+one'].join('\n');
    expect(at(diff)).toEqual(['ø æ.ts:1']);
  });

  it('reads nothing from an empty diff', () => {
    expect(addedLines('')).toEqual([]);
  });
});
