/**
 * The scrape behind the arm-builder half of `ruleCoverage.emits.test.ts`.
 *
 * It had no test of its own, and its one consumer was structurally always
 * empty, so a bug in either was invisible from both sides: the scrape returned
 * nothing, the loop iterated over nothing, and the guard was green. These feed
 * synthetic source text so the parsing is checked without depending on which
 * builders happen to exist in the tree this week.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { armBuilders, balancedGroup, parameterList, topLevelParts } from './emitsReach.js';

/** Write `source` to a throwaway `.ts` and hand back its path. */
function fileWith(source: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'emits-reach-')), 'builder.ts');
  writeFileSync(path, source, 'utf8');
  return path;
}

describe('parameterList', () => {
  it('keeps the parameters in order, which is what a call site is matched by', () => {
    expect(parameterList('node: TscnNode, rulePrefix: string')).toEqual(['node', 'rulePrefix']);
  });

  it('survives a nested type, a default and a rest parameter', () => {
    // The predecessor matched `(?:^|[(,])\s*(\w+)\s*[,:)]`, whose alternation
    // consumed the separating comma, so a two-parameter signature yielded one
    // name — and the one real builder templates its SECOND parameter.
    expect(parameterList('a: Record<string, number>, b = { x: 1, y: 2 }, ...rest: string[]')).toEqual(
      ['a', 'b', 'rest']
    );
    expect(parameterList('cb: (a: number, b: number) => void, after: string')).toEqual([
      'cb',
      'after',
    ]);
  });
});

describe('topLevelParts and balancedGroup', () => {
  it('splits on top-level commas only', () => {
    expect(topLevelParts("node, 'a, b', f(1, 2)").map((s) => s.trim())).toEqual([
      'node',
      "'a, b'",
      'f(1, 2)',
    ]);
  });

  it('reads to the MATCHING bracket, not the first one', () => {
    expect(balancedGroup('call(a, f(b), c) tail', 4)).toBe('a, f(b), c');
  });
});

describe('armBuilders', () => {
  it('pins the templated parameter to its position', () => {
    const file = fileWith(
      "export function make(node: TscnNode, rulePrefix: string) {\n" +
        '  return { ruleName: `${rulePrefix}-projector-without-shadow` };\n' +
        '}\n'
    );
    const { builders, unresolvable } = armBuilders([file]);
    expect(unresolvable).toEqual([]);
    expect(builders.get('make')).toEqual({
      index: 1,
      param: 'rulePrefix',
      templates: ['${rulePrefix}-projector-without-shadow'],
    });
  });

  it('keeps the WHOLE template, so a prefix in the middle substitutes', () => {
    // `valid-${prefix}-resources` is a name concatenation cannot produce.
    const file = fileWith(
      "export function make(prefix: string) {\n" +
        '  return { ruleName: `valid-${prefix}-resources` };\n' +
        '}\n'
    );
    expect(armBuilders([file]).builders.get('make')?.templates).toEqual([
      'valid-${prefix}-resources',
    ]);
  });

  it('ignores a builder whose rule names are literal, leaving them to the literal scrape', () => {
    const file = fileWith(
      "export function make(prefix: string) {\n" +
        "  return { ruleName: 'a-fixed-name' };\n" +
        '}\n'
    );
    expect(armBuilders([file]).builders.size).toBe(0);
  });

  it('reports a builder whose templates disagree about which parameter they use', () => {
    // Nothing here can pin one argument position, so the names it produces are
    // names nothing ties back to a rule — which is a defect, not a category.
    const file = fileWith(
      "export function make(a: string, b: string) {\n" +
        '  return [{ ruleName: `${a}-one` }, { ruleName: `${b}-two` }];\n' +
        '}\n'
    );
    const { builders, unresolvable } = armBuilders([file]);
    expect(builders.size).toBe(0);
    expect(unresolvable).toEqual(['make']);
  });
});
