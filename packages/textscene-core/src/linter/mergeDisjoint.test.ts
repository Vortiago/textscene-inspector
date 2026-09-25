import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { mergeDisjoint } from './mergeDisjoint.js';
import { allSourceFiles, srcLabel } from './testing/ruleNameScrape.js';

describe('mergeDisjoint', () => {
  it('merges parts that share no key', () => {
    expect(mergeDisjoint([{ a: 1 }, { b: 2 }, { c: 3 }], 'rows')).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('throws on a key two parts both declare, naming the key', () => {
    expect(() => mergeDisjoint([{ a: 1 }, { a: 2 }], 'census rows')).toThrow(
      'a has census rows in two parts'
    );
  });

  it('merges no parts into an empty table', () => {
    expect(mergeDisjoint([], 'rows')).toEqual({});
  });

  // The keys are Godot names, so a name that also lives on `Object.prototype`
  // is reachable and must read as undeclared until this table declares it.
  it('accepts a single declaration of an Object.prototype name', () => {
    expect(mergeDisjoint([{ toString: 1 }, { valueOf: 2 }, { constructor: 3 }], 'rows')).toEqual({
      toString: 1,
      valueOf: 2,
      constructor: 3,
    });
  });

  it('keeps `__proto__` as data rather than assigning through the setter', () => {
    const merged = mergeDisjoint([{ ['__proto__']: 1 }, { b: 2 }], 'rows');

    expect(Object.hasOwn(merged, '__proto__')).toBe(true);
    expect(merged['__proto__']).toBe(1);
  });

  it('refuses `__proto__` declared twice, like any other key', () => {
    expect(() => mergeDisjoint([{ ['__proto__']: 1 }, { ['__proto__']: 2 }], 'rows')).toThrow(
      '__proto__ has rows in two parts'
    );
  });

  it('still refuses an Object.prototype name declared twice', () => {
    expect(() => mergeDisjoint([{ toString: 1 }, { toString: 2 }], 'rows')).toThrow(
      'toString has rows in two parts'
    );
  });
});

/** The offset just past the string literal that opens at `start`, escapes included. */
function skipString(source: string, start: number): number {
  const quote = source[start];
  let at = start + 1;
  while (at < source.length && source[at] !== quote) at += source[at] === '\\' ? 2 : 1;
  return at + 1;
}

/**
 * The argument text of every `registerAll(…)` call in `source`, parentheses balanced. Comments are
 * blanked and string literals skipped first, since a cited interval such as `[0.1, 0.25)` in a
 * comment would close the call early and hide every key after it.
 */
function registerAllArguments(source: string): string[] {
  const bare = stripComments(source);
  const calls: string[] = [];
  for (const match of bare.matchAll(/\bregisterAll\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let at = start;
    while (at < bare.length && depth > 0) {
      const char = bare[at]!;
      if (char === "'" || char === '"' || char === '`') {
        at = skipString(bare, at);
        continue;
      }
      if (char === '(') depth++;
      else if (char === ')') depth--;
      at++;
    }
    calls.push(bare.slice(start, at - 1));
  }
  return calls;
}

/** An object spread, the last-wins merge `mergeDisjoint` replaces. */
const SPREAD = /\.\.\.\s*[\w(]/;

describe('every validator table built from parts goes through mergeDisjoint', () => {
  it('reads the argument of each registerAll call, nested calls included', () => {
    const source =
      "registerAll('A', mergeDisjoint([keys, { a: v.int('a') }], 'x'));\nregisterAll('B', { ...keys });";
    expect(registerAllArguments(source)).toEqual([
      "'A', mergeDisjoint([keys, { a: v.int('a') }], 'x')",
      "'B', { ...keys }",
    ]);
    expect(SPREAD.test("'B', { ...keys }")).toBe(true);
    expect(SPREAD.test("'B', { ...shared('a.cpp:1') }")).toBe(true);
    expect(SPREAD.test("'A', mergeDisjoint([keys], 'x')")).toBe(false);
  });

  it('reads past a paren inside a comment or a string literal', () => {
    const source = [
      "registerAll('A', {",
      '  // [0.1, 0.25) is the hint range.',
      "  a: v.float('a', { note: 'x)' }),",
      '  ...keys,',
      '});',
    ].join('\n');
    const [args] = registerAllArguments(source);
    expect(SPREAD.test(args!)).toBe(true);
    expect(args!.trimEnd().endsWith('}')).toBe(true);
  });

  it('spreads no part into a registerAll table', () => {
    const offenders = allSourceFiles()
      .filter((file) => registerAllArguments(readFileSync(file, 'utf8')).some((args) => SPREAD.test(args)))
      .map(srcLabel);
    expect(offenders).toEqual([]);
  });
});
