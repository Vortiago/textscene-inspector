/**
 * A test title may not name a tier its block does not assert.
 *
 * A failure report prints the test name first, so the name is what a reader
 * derives the tier from — a title saying "warns" beside `severity: 'info'` is
 * a stale comment in the one place nobody re-reads. Three hand sweeps of the
 * info-tier flip each left residue behind (57 titles, then 26, then 3), and the
 * pass that found the last three was this scan in script form, which is why it
 * is a test now rather than a habit.
 *
 * The rule is symmetric and takes no exemptions: when a block asserts exactly
 * ONE tier, its title may name that tier and no other. That admits the
 * deliberate contrast phrasing — "reports at info, not error, when …" names
 * both, and the asserted one is among them — without a roster to keep current.
 *
 * Scope is `it`/`test` blocks only. A `describe` covers children that may
 * legitimately disagree, and a negative assertion naming no severity asserts no
 * tier for this scan to compare against. A block that builds a `LintRule` as a
 * fixture is skipped: the `severity:` in its `check` is the value under test,
 * not a claim about a tier, so `Linter.test.ts` may say "parse errors" while
 * its fixture rule reports a warning.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { atLeast, srcRoot, walk } from './testing/ruleNameScrape.js';

const isTestFile = (name: string) => /\.test\.tsx?$/.test(name);

/** Every tier word, and the prose that claims it. */
const TIER_WORDS: Record<string, RegExp> = {
  error: /\berror(s|ed|ing)?\b/i,
  warning: /\bwarn(s|ed|ing|ings)?\b/i,
  info: /\binfo\b/i,
};

/** Both spellings an assertion uses: an object key, and a filtered comparison. */
const ASSERTED_TIER_RE = /\bseverity\s*(?::|===?)\s*'(error|warning|info)'/g;

/**
 * Where a block begins. `.each` takes an arbitrary expression — an inline table,
 * or a variable — so the argument is skipped by counting parentheses rather than
 * matched: `it.each(grounded)(` hid a stale title from the earlier sweep.
 */
const BLOCK_START_RE = /\b(it|test|describe)(\.each|\.skip|\.only|\.concurrent|\.failing)*\s*\(/g;

/** The index just past the balanced `(` at `open`, or -1 when it never closes. */
function afterBalanced(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

interface Block {
  readonly file: string;
  readonly line: number;
  readonly title: string;
  readonly body: string;
  readonly isCase: boolean;
}

/**
 * The `it`/`test`/`describe` blocks in one file, each body running to the next
 * block so a helper declared between two of them lands in neither.
 */
function blocksIn(file: string, src: string): Block[] {
  const starts: { at: number; titleFrom: number; isCase: boolean }[] = [];
  for (const m of src.matchAll(BLOCK_START_RE)) {
    const open = m.index + m[0].length - 1;
    // `it.each(<table>)(<title>, …)`: the title sits in the SECOND call.
    const each = m[2]?.includes('.each') ?? m[0].includes('.each(');
    const titleFrom = each ? afterBalanced(src, open) : open + 1;
    if (titleFrom < 0) continue;
    starts.push({ at: m.index, titleFrom, isCase: m[1] !== 'describe' });
  }
  const blocks: Block[] = [];
  for (const [i, s] of starts.entries()) {
    if (!s.isCase) continue;
    const end = starts[i + 1]?.at ?? src.length;
    const title = /\s*\(?\s*['"`]([^'"`]*)['"`]/.exec(src.slice(s.titleFrom, s.titleFrom + 400));
    if (!title) continue;
    blocks.push({
      file,
      line: src.slice(0, s.at).split('\n').length,
      title: title[1]!,
      body: src.slice(s.at, end),
      isCase: true,
    });
  }
  return blocks;
}

/** An inline `LintRule`, whose `severity:` is the fixture rather than a claim. */
const RULE_FIXTURE_RE = /\bmeta:\s*\{/;

/** The tiers a block asserts, deduplicated. */
const assertedTiers = (body: string): string[] =>
  RULE_FIXTURE_RE.test(body)
    ? []
    : [
        ...new Set([...body.matchAll(ASSERTED_TIER_RE)].map((m) => m[1]!)),
      ];

const allBlocks = (): Block[] => {
  const files = atLeast(walk(srcRoot, isTestFile), 500, 'test files');
  return atLeast(
    files.flatMap((file) => blocksIn(relative(srcRoot, file).replaceAll('\\', '/'), readFileSync(file, 'utf8'))),
    5000,
    'test blocks'
  );
};

describe('test titles name the tier they assert', () => {
  it('never claims a tier the block does not assert', () => {
    const drifted = allBlocks()
      .map((b) => ({ ...b, tiers: assertedTiers(b.body) }))
      .filter((b) => b.tiers.length === 1)
      .filter(({ title, tiers }) => {
        const asserted = tiers[0]!;
        if (TIER_WORDS[asserted]!.test(title)) return false;
        return Object.entries(TIER_WORDS).some(([tier, re]) => tier !== asserted && re.test(title));
      })
      .map((b) => `${b.file}:${b.line} asserts ${b.tiers[0]} — "${b.title}"`);
    expect(drifted).toEqual([]);
  });

  it('reads both assertion spellings and an .each table it cannot inline', () => {
    // The two forms the sweep missed, pinned so a narrower regex cannot make
    // the guard above vacuous: a `d.severity === 'info'` filter, and a title
    // that lives in the second call of `it.each(<variable>)(…)`.
    const src = [
      "it('a', () => { expect(d.every((x) => x.severity === 'info')).toBe(true); });",
      'const table = [{ a: 1 }];',
      "it.each(table)('b (%o)', () => { expectDiagnostic(s, { severity: 'warning' }); });",
    ].join('\n');
    const blocks = blocksIn('synthetic.test.ts', src);
    expect(blocks.map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['a', ['info']],
      ['b (%o)', ['warning']],
    ]);
  });
});
