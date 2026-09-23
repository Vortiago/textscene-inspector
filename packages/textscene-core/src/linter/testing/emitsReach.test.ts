/**
 * The scrape behind the arm-builder half of `ruleCoverage.emits.test.ts`. A
 * scrape that returns nothing leaves that guard green over an empty loop, so
 * these feed synthetic source text, independent of which builders exist.
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
    // An alternation that consumes the separating comma yields one name for
    // two parameters, and a real builder templates its second parameter.
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

describe('armBuilders comment and slot handling', () => {
  it('ignores a docblock between the parens', () => {
    // An apostrophe in prose ("min's") must not open a string, or the
    // signature runs to end-of-file and the params are prose words.
    const file = fileWith(
      'export function make(\n' +
        "  /** the node's own prefix, not the parent's */\n" +
        '  node: TscnNode,\n' +
        '  rulePrefix: string\n' +
        ') {\n' +
        '  return { ruleName: `${rulePrefix}-x` };\n' +
        '}\n'
    );
    expect(armBuilders([file]).builders.get('make')).toEqual({
      index: 1,
      param: 'rulePrefix',
      templates: ['${rulePrefix}-x'],
    });
  });

  it('holds the slot for a destructured parameter rather than shifting the rest', () => {
    const file = fileWith(
      'export function make({ node, scene }: Ctx, rulePrefix: string) {\n' +
        '  return { ruleName: `${rulePrefix}-x` };\n' +
        '}\n'
    );
    expect(armBuilders([file]).builders.get('make')?.index).toBe(1);
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
    // Nothing here pins one argument position, so nothing ties the names it
    // produces back to a rule: a defect, not a category.
    const file = fileWith(
      "export function make(a: string, b: string) {\n" +
        '  return [{ ruleName: `${a}-one` }, { ruleName: `${b}-two` }];\n' +
        '}\n'
    );
    const { builders, unresolvable } = armBuilders([file]);
    expect(builders.size).toBe(0);
    expect(unresolvable).toEqual([{ builder: 'make', templates: ['${a}-one', '${b}-two'] }]);
  });

  it('reports a builder that interpolates a LOCAL rather than a parameter', () => {
    // The physics factories' shape. Nothing pins the argument position, so a
    // scrape that `continue`s before the reporting branch loses it.
    const file = fileWith(
      'export function make(dim: string) {\n' +
        '  const prefix = `area${suffix(dim)}`;\n' +
        '  return { ruleName: `${prefix}-needs-collision-shape` };\n' +
        '}\n'
    );
    const { builders, unresolvable } = armBuilders([file]);
    expect(builders.size).toBe(0);
    expect(unresolvable).toEqual([
      { builder: 'make', templates: ['${prefix}-needs-collision-shape'] },
    ]);
  });

  it('sees a rule name hoisted into a local, not only the property form', () => {
    // The navigation factories write it this way, and a `ruleName:` scan finds
    // no template at all.
    const file = fileWith(
      'export function make(suffix: string) {\n' +
        '  const ruleName = `navigationagent${suffix}-parent-not-node`;\n' +
        '  return { ruleName };\n' +
        '}\n'
    );
    const { builders } = armBuilders([file]);
    expect(builders.get('make')).toEqual({
      index: 0,
      param: 'suffix',
      templates: ['navigationagent${suffix}-parent-not-node'],
    });
  });
});
