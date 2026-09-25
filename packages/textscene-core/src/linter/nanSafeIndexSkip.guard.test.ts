/**
 * An index read through `toIntIndex` is skipped with `!(index >= 0)`, never `index < 0`. NaN, which
 * the reader returns for a spelling no double names, passes `< 0` and seats a wrong element or
 * names a `NaN/0` joint. A report arm keeps `index < 0`, since NaN reports nothing there.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

/** A file's `src/`-relative path, the form the population is reported in. */
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/** A name bound to a `toIntIndex` read: `const index = toIntIndex(match[1]!)`. */
const INDEX_BINDING = /\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*toIntIndex\(/g;

/** `toIntIndex(…)` compared in place, one level of nested parentheses deep. */
const INLINE_READ = String.raw`toIntIndex\((?:[^()]|\([^()]*\))*\)`;

/**
 * A statement that skips rather than reports: `continue`, or a `return` that hands back no
 * finding (no value, `null`, `undefined`, `false` or `[]`). A report arm returns a call or an
 * object literal, which NaN never reaches.
 */
const SKIP = /^(?:continue\b|return\s*(?:;|\}|null\b|undefined\b|false\b|\[\s*\]))/;

/** One `if` statement: its condition, and the text of the statement it guards, braces opened. */
interface IfStatement {
  condition: string;
  guarded: string;
}

/**
 * Every `if (…)` in `src`, its condition read by balancing parentheses. Strings are not skipped: a
 * parenthesis in one can only misplace a condition's end, and the test below still asks for a bound
 * index name compared with `< 0`, which no string holds.
 */
function ifStatements(src: string): IfStatement[] {
  const statements: IfStatement[] = [];
  for (const match of src.matchAll(/\bif\s*\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < src.length && depth > 0; end++) {
      if (src[end] === '(') depth++;
      else if (src[end] === ')') depth--;
    }
    statements.push({
      condition: src.slice(start, end - 1),
      guarded: src.slice(end).replace(/^\s*\{?\s*/, ''),
    });
  }
  return statements;
}

/** The `if (…)` heads in `source` that skip a `toIntIndex` read on `< 0`, or none. */
function unsafeIndexSkips(source: string): string[] {
  const src = stripComments(source);
  const names = [...src.matchAll(INDEX_BINDING)].map((m) => String.raw`\b${m[1]!}\b`);
  // `(?![.\d])`: `< 0.5` is a different comparison, and `<=` never matches `<\s*0`.
  const belowZero = new RegExp(String.raw`(?:${[...names, INLINE_READ].join('|')})\s*<\s*0(?![.\d])`);
  return ifStatements(src)
    .filter(({ condition, guarded }) => belowZero.test(condition) && SKIP.test(guarded))
    .map(({ condition }) => `if (${condition})`);
}

describe('an index read through toIntIndex is skipped NaN-safely', () => {
  const population = allSourceFiles()
    .map((file) => ({ rel: label(file), src: readFileSync(file, 'utf8') }))
    .filter(({ src }) => /\btoIntIndex\(/.test(stripComments(src)));

  it('finds the readers, so the sweep cannot pass vacuously', () => {
    // Far below the real count: this catches a scrape that broke, not a tree that changed.
    expect(population.length).toBeGreaterThan(8);
    expect(population.map(({ rel }) => rel)).toContain('nodes/3d/skeleton/twoboneik3d/linter.ts');
  });

  it('never skips such an index on `< 0`', () => {
    const offenders = population
      .flatMap(({ rel, src }) => unsafeIndexSkips(src).map((head) => `${rel}: ${head}`))
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * A fence, not a regression test: it passes on either side of the sweep above, and states that
   * the scanner still tells a skip from a report.
   */
  it('flags each skip spelling, and leaves the NaN-safe skip and a report arm alone', () => {
    const bound = 'const settingIndex = toIntIndex(match[1]!);\n';
    expect(unsafeIndexSkips(`${bound}if (settingIndex < 0) continue;`)).toEqual([
      'if (settingIndex < 0)',
    ]);
    expect(unsafeIndexSkips(`${bound}if (settingIndex < 0) {\n  continue;\n}`)).toHaveLength(1);
    expect(unsafeIndexSkips(`${bound}if (settingIndex < 0 || settingIndex >= count) return [];`))
      .toHaveLength(1);
    expect(unsafeIndexSkips('if (toIntIndex(joint[2]!) < 0) return null;')).toHaveLength(1);

    expect(unsafeIndexSkips(`${bound}if (!(settingIndex >= 0)) continue;`)).toEqual([]);
    expect(unsafeIndexSkips(`${bound}if (settingIndex < 0) return keyShapeError(key, line, m, c);`))
      .toEqual([]);
    expect(unsafeIndexSkips(`${bound}if (settingIndex < 0) {\n  return keyShapeError(key, line, m, c);\n}`))
      .toEqual([]);
    // A `< 0` on a name no `toIntIndex` read binds is some other comparison.
    expect(unsafeIndexSkips('const cut = key.lastIndexOf("/");\nif (cut < 0) return;')).toEqual([]);
  });
});
