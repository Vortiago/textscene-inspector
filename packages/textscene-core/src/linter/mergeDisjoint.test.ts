import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { mergeDisjoint } from './mergeDisjoint.js';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

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

/**
 * The argument text of every `registerAll(…)` call in `source`, parentheses balanced. A string
 * or comment holding a paren would skew the count, and none of the scanned calls holds one.
 */
function registerAllArguments(source: string): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(/\bregisterAll\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')') depth--;
    }
    calls.push(source.slice(start, end - 1));
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

  it('spreads no part into a registerAll table', () => {
    const offenders = allSourceFiles()
      .filter((file) => registerAllArguments(readFileSync(file, 'utf8')).some((args) => SPREAD.test(args)))
      .map((file) => relative(srcRoot, file).replaceAll('\\', '/'));
    expect(offenders).toEqual([]);
  });

  it('throws at registration when two key groups of one type declare the same key', () => {
    // The shape each migrated table now has: a duplicate names itself at import time.
    const surface = { albedo_color: 'surface' };
    const pbr = { albedo_color: 'pbr', metallic: 'pbr' };
    expect(() => mergeDisjoint([surface, pbr], 'a BaseMaterial3D validator')).toThrow(
      'albedo_color has a BaseMaterial3D validator in two parts'
    );
  });
});
