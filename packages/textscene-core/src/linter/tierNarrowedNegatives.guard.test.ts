/**
 * Refuses a hand-written negative narrowed to a tier and to one diagnostic. It
 * cannot fail once that diagnostic's tier moves, while the test kit's `expectNoErrors`
 * and `expectNoDiagnostic({ severity })` first check that the tier is reachable.
 */

import { describe, expect, it } from 'vitest';
import { blocksIn, testBlocksExcept, type Block } from './testing/testBlocks.js';
import { atLeast } from './testing/ruleNameScrape.js';
import { canHoldTierNarrowedNegative, tierNarrowedNegatives } from './testing/tierNarrowedNegatives.js';

/**
 * About 1,460 blocks sit in the files that narrow to a tier. A prefilter that breaks and matches
 * almost nothing falls far below this, and the guard fails instead of passing on nothing.
 */
const MIN_NARROWING_BLOCKS = 1000;

/** This file, excluded by path: its pins spell the refused shapes as data. */
const SELF = 'linter/tierNarrowedNegatives.guard.test.ts';

/** The hand-written negatives in `blocks`, each as `file:line` and its statement. */
function offendersIn(blocks: Block[]): string[] {
  return blocks.flatMap((block) =>
    tierNarrowedNegatives(block.body).map((statement) => `${block.file}:${block.line} ${statement.trim()}`)
  );
}

describe('negatives narrowed to a tier go through the test kit', () => {
  it('finds none spelled by hand', () => {
    const blocks = testBlocksExcept(SELF, canHoldTierNarrowedNegative);
    expect(offendersIn(atLeast(blocks, MIN_NARROWING_BLOCKS, 'blocks that narrow to a tier'))).toEqual([]);
  });

  it('reads the three shapes a hand-written one takes', () => {
    const src = [
      "it('some', () => { expect(all.some((d) => d.severity === 'warning' && d.message.includes('x'))).toBe(false); });",
      "it('find', () => { expect(all.find((d) => d.ruleName === 'r' && d.severity === 'info')).toBeUndefined(); });",
      "it('bound', () => { const hits = all.filter((d) => d.message.includes('x') && d.severity === 'error'); expect(hits).toHaveLength(0); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => tierNarrowedNegatives(b.body).length)).toEqual([
      1, 1, 1,
    ]);
  });

  it('reads only the files that narrow to a tier', () => {
    const narrowed = ["d.severity === 'warning'", 'errorsOf(all)', "d.severity  ===  'info'"];
    const unnarrowed = ["d.severity === 'fatal'", 'd.severity', 'Errors(all)'];

    expect(narrowed.map(canHoldTierNarrowedNegative)).toEqual([true, true, true]);
    expect(unnarrowed.map(canHoldTierNarrowedNegative)).toEqual([false, false, false]);
  });

  it('reads a narrowing with a comment inside it, as the block scan blanks comments (edge case)', () => {
    const commented = [
      "d.severity /* tier */ === 'warning'",
      "d.severity ===\n// the tier\n'info'",
      'errorsOf /* all */ (all)',
    ];

    expect(commented.map(canHoldTierNarrowedNegative)).toEqual([true, true, true]);
  });

  it('reads a tier list helper as the tier narrowing', () => {
    const src = [
      "it('some', () => { expect(errorsOf(all).some((d) => d.message.includes('x'))).toBe(false); });",
      "it('bound', () => { const hits = warningsOf(all).filter((d) => d.ruleName === 'r'); expect(hits).toEqual([]); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => tierNarrowedNegatives(b.body).length)).toEqual([
      1, 1,
    ]);
  });

  it('leaves a positive, an unnarrowed negative and a tier-only negative alone', () => {
    // Only a tier with an identity can stop failing: "no errors at all" stays
    // falsifiable, since a format failure always errors.
    const src = [
      "it('positive', () => { expect(all.some((d) => d.severity === 'warning' && d.message.includes('x'))).toBe(true); });",
      "it('identity', () => { expect(all.some((d) => d.message.includes('x'))).toBe(false); });",
      "it('tier', () => { expect(all.filter((d) => d.severity === 'error')).toHaveLength(0); });",
      "it('list', () => { expect(errorsOf(all)).toEqual([]); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => tierNarrowedNegatives(b.body))).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });
});
