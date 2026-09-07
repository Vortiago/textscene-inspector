/**
 * A test title may not name a tier its block does not assert.
 *
 * A failure report prints the test name first, so the name is what a reader
 * derives the tier from — a title saying "warns" beside `severity: 'info'` is
 * a stale comment in the one place nobody re-reads.
 *
 * The rule is symmetric and takes no exemptions: when a block asserts exactly
 * ONE tier, its title may name that tier and no other. That admits the
 * deliberate contrast phrasing — "reports at info, not error, when …" names
 * both, and the asserted one is among them — without a roster to keep current.
 *
 * Scope is `it`/`test` blocks under this package's `src`. A `describe` covers
 * children that may legitimately disagree, and a negative assertion naming no
 * severity asserts no tier for this scan to compare against. The two host apps
 * keep their own test files, which this walk cannot reach from inside the
 * package. A block that builds a `LintRule` as a fixture is skipped: the
 * `severity:` in its `check` is the value under test, not a claim about a tier,
 * so `Linter.test.ts` may say "parse errors" while its fixture rule reports a
 * warning.
 *
 * `validatorCheck.test.ts` is the one file whose `expectError` call is the
 * SUBJECT rather than a claim: it proves the helper throws on the wrong tier.
 * Its titles satisfy this guard by naming both tiers, so a reword that drops
 * one is a false positive rather than a drifted title.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { atLeast, srcRoot, walk } from './testing/ruleNameScrape.js';
import type { Severity } from './types.js';

const isTestFile = (name: string) => /\.test\.tsx?$/.test(name);

/** Every tier word, and the prose that claims it. Total over `Severity`. */
const TIER_WORDS: Record<Severity, RegExp> = {
  error: /\b(?:errs?|errors?|errored|erroring)\b/i,
  warning: /\b(?:warns?|warned|warnings?)\b/i,
  info: /\binfos?\b/i,
};

/**
 * Where a block begins.
 *
 * The lookbehind is what keeps a method call out: `\b` holds between `.` and
 * `test`, so `SOME_RE.test(value)` opens a block, truncating the real block
 * around it — its assertion falls outside the body and the block reads as
 * claiming no tier at all — and inventing one whose title is the next string
 * literal in sight.
 *
 * `.each` takes an arbitrary expression — an inline table, or a variable — so
 * the argument is skipped by counting parentheses rather than matched, and the
 * whole dotted chain is one capture because only the last repetition of a
 * repeated group survives.
 */
const BLOCK_START_RE = /(?<![.$\w])(it|test|describe)((?:\.\w+)*)\s*\(/g;

/**
 * Where a tier claim starts.
 *
 * `severities` too, and with no trailing boundary: a mapped list asserts its
 * tiers through `expect(severitiesOf(…)).toEqual(['info'])` and never spells
 * the `severity:` key at all. `expectSeverity` and `expectRejected` take the
 * tier as an argument and spell no lowercase `severit` for the first
 * alternative to reach — a capital `S` sits inside the word, where `\b` does
 * not hold.
 */
const TIER_ANCHOR_RE = /\b(?:severit(?:y|ies)|expect(?:Severity|Rejected))/g;

/**
 * A tier claimed by the assertion helper's own NAME, with no literal anywhere.
 *
 * `expectError(error, …)` and `expectWarning(…)` (`testing/validatorCheck.ts`)
 * carry the tier in the identifier and take message substrings for arguments,
 * so the anchor above reaches neither. Total over `Severity` rather than over
 * the two helpers that exist today, so a third lands inside the sweep.
 */
const TIER_HELPER_RE = /\bexpect(Error|Warning|Info)\s*\(/g;

/** A tier named as a literal. */
const TIER_LITERAL_RE = /'(error|warning|info)'/g;

/**
 * How far one claim reaches: its own statement, and never past this. A claim
 * with no `;` in reach is read to the cap rather than to the file's end.
 */
const CLAIM_REACH = 240;

/**
 * A tier NAMED to be excluded is not a tier asserted — `filter(d => d.severity
 * !== 'error')` and `.not.toBe('info')` both spell one. Read over the whole
 * claim rather than per literal, so an ambiguous claim is skipped instead of
 * fabricating a tier.
 */
const EXCLUDES_RE = /(?:!==?|\.not\b)/;

/** The index just past the balanced `(` at `open`, or -1 when it never closes. */
function afterBalanced(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

/** The `(` at `from`, past any whitespace, or -1 when something else is there. */
function openParenAt(src: string, from: number): number {
  if (from < 0) return -1;
  let i = from;
  while (i < src.length && /\s/.test(src[i]!)) i++;
  return src[i] === '(' ? i : -1;
}

/**
 * The block's title, when its first argument is a string literal, and where it
 * ends.
 *
 * Sticky rather than a windowed slice, which drops a title longer than the
 * window — and its whole block with it — in silence. Closed by the quote it
 * opened with, because a `[^'"`]` class cuts `(the "no maximum" sentinel)` at
 * the inner quote and hides every tier word behind it.
 */
const TITLE_RE = /\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/y;
function titleAt(src: string, from: number): { text: string; end: number } | null {
  TITLE_RE.lastIndex = from;
  const m = TITLE_RE.exec(src);
  return m ? { text: m[2]!, end: TITLE_RE.lastIndex } : null;
}

interface Block {
  readonly file: string;
  readonly line: number;
  readonly title: string;
  readonly body: string;
}

/**
 * The body of the block opened at `at`: its own call, and never the next
 * block's, nor anything declared after it.
 *
 * A body running to the next START reads the `severity:` in a
 * `runPropertyValidation` table declared BELOW the block as the block's own.
 * Parentheses inside a string literal count like any other, so the close is
 * believed only when it lands on `})` at or before the next start; otherwise
 * the next start bounds the body.
 */
function bodyOf(src: string, at: number, callOpen: number, nextAt: number): string {
  const close = afterBalanced(src, callOpen);
  const closes = close > at && close <= nextAt && /\}\s*\)$/.test(src.slice(close - 16, close));
  return src.slice(at, closes ? close : nextAt);
}

/**
 * The `it`/`test` blocks in one file, each body bounded by `bodyOf`.
 *
 * Comments are blanked first, at preserved offsets: comment lines here spell
 * block starts and `severity:` assertions alike, and every other scraping
 * guard in this package strips them for the same reason.
 */
function blocksIn(file: string, source: string): Block[] {
  const src = stripComments(source);
  const starts: { at: number; callOpen: number; title: string | null; isCase: boolean }[] = [];
  // How far a title already read reaches. A block start inside one is PROSE:
  // `the setter never checks it (tile_map.cpp:996)` opens a block exactly the
  // way `SOME_RE.test(` does, and truncates the block it sits in.
  let readThrough = 0;
  for (const m of src.matchAll(BLOCK_START_RE)) {
    if (m.index < readThrough) continue;
    const open = m.index + m[0].length - 1;
    // `it.each(<table>)(<title>, …)`: the title sits in the SECOND call, so
    // the table is skipped by counting parentheses rather than matched.
    const callOpen = m[2]!.includes('.each') ? openParenAt(src, afterBalanced(src, open)) : open;
    if (callOpen < 0) continue;
    const title = titleAt(src, callOpen + 1);
    readThrough = title?.end ?? callOpen + 1;
    starts.push({ at: m.index, callOpen, title: title?.text ?? null, isCase: m[1] !== 'describe' });
  }
  const blocks: Block[] = [];
  // One forward pass for line numbers: a per-block `slice(0, at).split('\n')`
  // rebuilds the whole file once per block.
  let scanned = 0;
  let line = 1;
  for (const [i, s] of starts.entries()) {
    while (scanned < s.at) {
      if (src[scanned] === '\n') line++;
      scanned++;
    }
    if (!s.isCase || s.title === null) continue;
    const body = bodyOf(src, s.at, s.callOpen, starts[i + 1]?.at ?? src.length);
    blocks.push({ file, line, title: s.title, body });
  }
  return blocks;
}

/** An inline `LintRule`, whose `severity:` is the fixture rather than a claim. */
const RULE_FIXTURE_RE = /\bmeta:\s*\{/;

/** The tiers a block asserts, deduplicated. */
const assertedTiers = (body: string): string[] => {
  if (RULE_FIXTURE_RE.test(body)) return [];
  const tiers = new Set<string>();
  for (const m of body.matchAll(TIER_HELPER_RE)) tiers.add(m[1]!.toLowerCase());
  for (const anchor of body.matchAll(TIER_ANCHOR_RE)) {
    const claim = body.slice(anchor.index, anchor.index + CLAIM_REACH).split(';')[0]!;
    if (EXCLUDES_RE.test(claim)) continue;
    for (const m of claim.matchAll(TIER_LITERAL_RE)) tiers.add(m[1]!);
  }
  return [...tiers];
};

/**
 * This file. Its pins spell whole `it(…)` blocks as data, so scanning itself
 * reads a pin as a subject. Excluded by path rather than by an exemption
 * entry, the same way `populationDiscipline.guard.test.ts` drops its own.
 */
const SELF = 'linter/testTitleTier.guard.test.ts';

const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

const allBlocks = (): Block[] => {
  const files = atLeast(walk(srcRoot, isTestFile), 500, 'test files').map(label);
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
    // The scrape's own floor counts BLOCKS, and the ones this guard actually
    // checks are the far smaller set carrying exactly one tier — so a narrowed
    // anchor drops subjects with the walk intact and the list still empty. The
    // drift pin belongs at the call site, which is where the population is.
    const checked = atLeast(
      allBlocks()
        .map((b) => ({ ...b, tiers: assertedTiers(b.body) }))
        .filter((b) => b.tiers.length === 1),
      1600,
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
    // The six spellings a tier reaches the file by, pinned so a narrower regex
    // cannot make the guard above vacuous — only the first and the last spell
    // `severity:`, and the two helper forms spell no literal at all. Plus a
    // title that lives in the second call of `it.each(<variable>)(…)`.
    const src = [
      "it('a', () => { expect(d.every((x) => x.severity === 'info')).toBe(true); });",
      "it('b', () => { expect(reports[0]?.severity).toBe('warning'); });",
      "it('c', () => { expect(severitiesOf(content, 'some-rule')).toEqual(['error']); });",
      "it('e', () => { expectWarning(check('x', '1'), 'x'); });",
      "it('f', () => { expectSeverity(content, 'error'); });",
      'const table = [{ a: 1 }];',
      "it.each(table)('d (%o)', () => { expectDiagnostic(s, { severity: 'info' }); });",
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['a', ['info']],
      ['b', ['warning']],
      ['c', ['error']],
      ['e', ['warning']],
      ['f', ['error']],
      ['d (%o)', ['info']],
    ]);
  });

  it('keeps a title that spells a block start, and a table below one, out of the scan', () => {
    // Both fabricate: `it (` in PROSE opens a block that truncates the real
    // one around it, and a body running to the next START reads the
    // `severity:` in a table declared after the block as the block's own.
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
