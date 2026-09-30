/**
 * A test title may not name a tier its block does not assert: a failure report
 * prints the title first. When a block asserts exactly one tier, its title may
 * name that tier and no other, which admits "reports at info, not error" with no
 * roster. `validatorCheck.test.ts` titles name both tiers, since its subject is the helper.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atLeast, srcLabel, srcRoot, walk } from './testing/ruleNameScrape.js';
import { blocksIn, type Block } from './testing/testBlocks.js';
import { assertedTiers } from './testing/tierClaims.js';
import type { Severity } from './types.js';

const isTestFile = (name: string) => /\.test\.tsx?$/.test(name);

/** Every tier word, and the prose that claims it. Total over `Severity`. */
const TIER_WORDS: Record<Severity, RegExp> = {
  error: /\b(?:errs?|errors?|errored|erroring)\b/i,
  warning: /\b(?:warns?|warned|warnings?)\b/i,
  info: /\binfos?\b/i,
};

/**
 * This file, excluded by path: its pins spell whole `it(…)` blocks as data,
 * which a scan would read as subjects.
 */
const SELF = 'linter/testTitleTier.guard.test.ts';

/**
 * Scope is `it` and `test` blocks under this package's `src`: a `describe` may
 * cover children that disagree, a negative assertion naming no severity asserts
 * no tier, and the host apps sit outside the walk. A block that builds a
 * `LintRule` fixture is skipped, since its `severity:` is the value under test.
 */
const allBlocks = (): Block[] => {
  const files = atLeast(walk(srcRoot, isTestFile), 500, 'test files').map(srcLabel);
  // A renamed file drops silently out of an exclusion by path, and the pins
  // below would then be scanned as subjects.
  expect(files).toContain(SELF);
  return atLeast(
    files
      .filter((file) => file !== SELF)
      .flatMap((file) => blocksIn(file, readFileSync(join(srcRoot, file), 'utf8'))),
    5000,
    'test blocks'
  );
};

describe('test titles name the tier they assert', () => {
  it('never claims a tier the block does not assert', () => {
    // The scrape's floor counts blocks, but this guard checks only those with
    // exactly one tier, so a narrowed anchor drops subjects with the walk
    // intact. That floor sits here, above the 1,756 blocks read without `.tiers`,
    // emptied exclusions and bound list helpers. It is a floor, not a drift pin.
    const checked = atLeast(
      allBlocks()
        .map((b) => ({ ...b, tiers: assertedTiers(b.body) }))
        .filter((b) => b.tiers.length === 1),
      1800,
      'blocks asserting exactly one tier'
    );
    const drifted = checked
      .filter(({ title, tiers }) => {
        const asserted = tiers[0] as Severity;
        if (TIER_WORDS[asserted].test(title)) return false;
        return Object.entries(TIER_WORDS).some(([tier, re]) => tier !== asserted && re.test(title));
      })
      .map((b) => `${b.file}:${b.line} asserts ${b.tiers[0]} — "${b.title}"`);
    expect(drifted).toEqual([]);
  });

  it('reads every assertion spelling, and an .each table it cannot inline', () => {
    // Every spelling a tier arrives by, pinned so a narrower regex cannot make
    // the guard above vacuous. This is the only proof of some `NON_EMPTY_RE`
    // arms, and of a title in the second call of `it.each(<variable>)(…)`.
    const src = [
      "it('a', () => { expect(d.every((x) => x.severity === 'info')).toBe(true); });",
      "it('b', () => { expect(reports[0]?.severity).toBe('warning'); });",
      "it('c', () => { expect(severitiesOf(content, 'some-rule')).toEqual(['error']); });",
      "it('e', () => { expectWarning(check('x', '1'), 'x'); });",
      "it('f', () => { expectSeverity(content, 'error'); });",
      "it('g', () => { expect(errorsOf(linter.lint(c))).toHaveLength(1); });",
      "it('h', () => { expect(warningsOf(linter.lint(c))[0].message).toBe('x'); });",
      "it('i', () => { expect(infosOf(linter.lint(c)).length).toBe(2); });",
      "it('j', () => { expect(errorsOf(linter.lint(c)).length).toBeGreaterThan(0); });",
      "it('k', () => { expect(validator?.tiers).toEqual({ min: 'warning', max: 'warning' }); });",
      "it('l', () => { expect(coinciding.tiers?.min).toBe('error'); });",
      "it('n', () => { expect(reportsOf(linter.lint(c), RULE, 'warning')).toHaveLength(1); });",
      'const table = [{ a: 1 }];',
      "it.each(table)('d (%o)', () => { expectDiagnostic(s, { severity: 'info' }); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['a', ['info']],
      ['b', ['warning']],
      ['c', ['error']],
      ['e', ['warning']],
      ['f', ['error']],
      ['g', ['error']],
      ['h', ['warning']],
      ['i', ['info']],
      ['j', ['error']],
      ['k', ['warning']],
      ['l', ['error']],
      ['n', ['warning']],
      ['d (%o)', ['info']],
    ]);
  });

  it('reads a list helper as a tier only where the block asserts the list is non-empty', () => {
    // `const errors = errorsOf(x)` binds a list and claims nothing; the tier
    // arrives with the assertion, and `toHaveLength(0)` asserts the tier is
    // absent. Reading the bare call as a claim inverts both.
    const src = [
      "it('a', () => { expect(errorsOf(linter.lint(c))).toHaveLength(0); });",
      "it('b', () => { const errors = errorsOf(linter.lint(c)); expect(errors).toEqual([]); });",
      "it('c', () => { expect(reportsOf(linter.lint(c), RULE, 'warning')).toEqual([]); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['a', []],
      ['b', []],
      ['c', []],
    ]);
  });

  it('follows a list helper through the name it is bound to', () => {
    // Most sites bind the list and assert on the name in a later statement,
    // which a claim read to its own `;` never reaches.
    const src = [
      "it('length', () => { const reports = reportsOf(check(body), RULE, 'warning'); expect(reports).toHaveLength(1); });",
      "it('indexed', () => { const errors = errorsOf(linter.lint(c)); expect(errors[0]!.message).toContain('x'); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['length', ['warning']],
      ['indexed', ['error']],
    ]);
  });

  it('reads an exclusion whose survivors are asserted empty as a claim of the excluded tier', () => {
    // No diagnostic other than `error` survives, so every one is `error`: the
    // same claim as `every((d) => d.severity === 'error')`, whichever way the
    // survivors reach the emptiness assertion.
    const src = [
      "it('inline', () => { expect(all.filter((d) => d.severity !== 'error')).toEqual([]); });",
      "it('bound', () => { const wrongTier = judged.filter((j) => j.diagnostic?.severity !== 'warning').map((j) => j.at); expect(wrongTier).toEqual([]); });",
      "it('pushed', () => { const wrong = []; for (const v of all) { if (v.tiers![end] !== 'error') { wrong.push(v.label); } } expect(wrong).toHaveLength(0); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['inline', ['error']],
      ['bound', ['warning']],
      ['pushed', ['error']],
    ]);
  });

  it('keeps an exclusion out of the scan unless its own survivors are asserted empty', () => {
    // `every(… !== …)` asserts the tier is absent, a list with survivors
    // asserts nothing about them, and an empty sub-filter empties a different list.
    const src = [
      "it('every', () => { expect(all.every((d) => d.severity !== 'error')).toBe(true); });",
      "it('kept', () => { const kept = all.filter((d) => d.severity !== 'error'); expect(kept).toHaveLength(2); });",
      "it('narrowed', () => { const kept = all.filter((d) => d.severity !== 'error'); expect(kept.filter((d) => d.x)).toEqual([]); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['every', []],
      ['kept', []],
      ['narrowed', []],
    ]);
  });

  it('keeps an emptied exclusion that names two tiers out of the scan', () => {
    // Its survivors are `info` only, a tier no literal in it names.
    const src =
      "it('a', () => { expect(all.filter((d) => d.severity !== 'error' && d.severity !== 'warning')).toEqual([]); });";

    expect(blocksIn('synthetic.test.ts', src).map((b) => assertedTiers(b.body))).toEqual([[]]);
  });

  it('keeps a title that spells a block start, and a table below one, out of the scan', () => {
    // Both fabricate: `it (` in prose opens a block that truncates the real
    // one, and a body running to the next start reads a later table's
    // `severity:` as its own.
    const src = [
      "it('errors on a negative index — set_slot refuses it (graph_node.cpp:706)', () => {",
      "  expect(check('slot/-1/left_enabled', 'true')?.severity).toBe('error');",
      '});',
      "it('passes a valid node', () => {",
      '  expectClean(scene(node()));',
      '});',
      'runPropertyValidation({ nodeType: "GraphNode" }, [',
      "  { prop: 'x', invalid: [{ value: 1, severity: 'warning' }] },",
      ']);',
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['errors on a negative index — set_slot refuses it (graph_node.cpp:706)', ['error']],
      ['passes a valid node', []],
    ]);
  });

  it('reads tiers as a property only, never as a word in a title', () => {
    // A block's body starts at its title, so a bare `tiers` anchor would read
    // the first statement's literal as a claim the title made.
    const src = "it('reports the two ends at different tiers', () => { const probe = 'error'; });";

    expect(blocksIn('synthetic.test.ts', src).map((b) => assertedTiers(b.body))).toEqual([[]]);
  });

  it('keeps a method call, a comment and an excluded tier out of the scan', () => {
    // Each of the three fabricates a block or a tier: `.test(` truncates the
    // block it sits in, a commented-out assertion claims a tier the code never
    // asserts, and a `!==` filter names the tier it drops.
    const src = [
      "it('reports at info when the shape is degenerate', () => {",
      '  expect(SOME_RE.test(value)).toBe(true);',
      "  // expectDiagnostic(s, { severity: 'warning' });",
      "  const kept = all.filter((d) => d.severity !== 'error');",
      "  expectDiagnostic(kept[0], { severity: 'info' });",
      '});',
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['reports at info when the shape is degenerate', ['info']],
    ]);
  });

  it('reads a title through the quote it opens with, not the first quote it meets', () => {
    const src = "it('reports nothing when max_size is Vector2i(0, 0) (the \"no maximum\" sentinel)', () => {});";

    expect(blocksIn('synthetic.test.ts', src)[0]?.title).toBe(
      'reports nothing when max_size is Vector2i(0, 0) (the "no maximum" sentinel)'
    );
  });
});
