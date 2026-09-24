/**
 * A test title may not name a tier its block does not assert: a failure report
 * prints the title first. When a block asserts exactly one tier, its title may
 * name that tier and no other, which admits "reports at info, not error" with no
 * roster. `validatorCheck.test.ts` titles name both tiers, since its subject is the helper.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { atLeast, srcRoot, walk } from './testing/ruleNameScrape.js';
import { SEVERITIES, type Severity } from './types.js';

const isTestFile = (name: string) => /\.test\.tsx?$/.test(name);

/**
 * The tier names, spelled for a regex and read off the shared roster, so a new
 * tier reaches every matcher below and not only the table tsc checks.
 */
const TIER_NAMES = SEVERITIES.join('|');
const TIER_NAMES_CAPITALISED = SEVERITIES.map((t) => t[0]!.toUpperCase() + t.slice(1)).join('|');

/** Every tier word, and the prose that claims it. Total over `Severity`. */
const TIER_WORDS: Record<Severity, RegExp> = {
  error: /\b(?:errs?|errors?|errored|erroring)\b/i,
  warning: /\b(?:warns?|warned|warnings?)\b/i,
  info: /\binfos?\b/i,
};

/**
 * Where a block begins. The lookbehind keeps a method call out: `\b` holds
 * between `.` and `test`, so `SOME_RE.test(value)` would truncate the real block.
 * The dotted chain is one capture, since only the last repetition of a repeated
 * group survives.
 */
const BLOCK_START_RE = /(?<![.$\w])(it|test|describe)((?:\.\w+)*)\s*\(/g;

/**
 * Where a tier claim starts. `severities` too, with no trailing boundary, for
 * `expect(severitiesOf(…)).toEqual(['info'])`. `expectSeverity` and
 * `expectRejected` are their own alternative: the capital `S` sits inside the
 * word, where `\b` does not hold.
 */
const TIER_ANCHOR_RE = /\b(?:severit(?:y|ies)|expect(?:Severity|Rejected))/g;

/**
 * A tier claimed by the assertion helper's own name, such as `expectError(…)` in
 * `testing/validatorCheck.ts`, which the anchor above cannot reach. Total over
 * `Severity`, so a new helper lands inside the sweep.
 */
const TIER_HELPER_RE = new RegExp(`\\bexpect(${TIER_NAMES_CAPITALISED})\\s*\\(`, 'g');

/**
 * A list helper whose name carries the tier: `errorsOf(…)`, `warningsOf(…)`.
 * Neither anchor above reaches one.
 */
const TIER_LIST_RE = new RegExp(`\\b(${TIER_NAMES})sOf\\s*\\(`, 'g');

/**
 * What makes a list helper a claim: the same statement asserts the list is
 * non-empty. Positive evidence, because `const errors = errorsOf(x);` alone
 * claims nothing, and `toHaveLength(0)` asserts the tier is absent.
 */
const NON_EMPTY_RE = /toHaveLength\(\s*[1-9]|toBeGreaterThan\(\s*0|length\)\.toBe\(\s*[1-9]|\[0\]/;

/** A tier named as a literal. */
const TIER_LITERAL_RE = new RegExp(`'(${TIER_NAMES})'`, 'g');

/**
 * How far one claim reaches: its own statement, and never past this. A claim
 * with no `;` in reach is read to the cap rather than to the file's end.
 */
const CLAIM_REACH = 240;

/**
 * A tier named to be excluded is not a tier asserted: `filter(d => d.severity
 * !== 'error')` and `.not.toBe('info')` both spell one. Read over the whole
 * claim, so an ambiguous claim is skipped instead of fabricating a tier.
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

/** Module level: this is tested once per source character between two calls. */
const WHITESPACE = /\s/;

/** The `(` at `from`, past any whitespace, or -1 when something else is there. */
function openParenAt(src: string, from: number): number {
  if (from < 0) return -1;
  let i = from;
  while (i < src.length && WHITESPACE.test(src[i]!)) i++;
  return src[i] === '(' ? i : -1;
}

/**
 * The block's title, when its first argument is a string literal, and where it
 * ends. Sticky, since a windowed slice drops a long title. Closed by the quote
 * it opened with, since `[^'"`]` cuts `(the "no maximum" sentinel)` short.
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
 * The body of the block opened at `at`: its own call, never a table declared
 * below it. Parentheses in a string count too, so the close is believed only
 * when it lands on `})` at or before the next start, which bounds it otherwise.
 */
function bodyOf(src: string, at: number, callOpen: number, nextAt: number): string {
  const close = afterBalanced(src, callOpen);
  // `Math.max`: a negative `slice` start counts from the end of the file, so a
  // block closing inside the first 16 characters would be judged on the tail.
  const closes =
    close > at && close <= nextAt && /\}\s*\)$/.test(src.slice(Math.max(0, close - 16), close));
  return src.slice(at, closes ? close : nextAt);
}

/**
 * The `it`/`test` blocks in one file, each body bounded by `bodyOf`. Comments
 * are blanked first, at preserved offsets, since they spell block starts and
 * `severity:` assertions alike.
 */
function blocksIn(file: string, source: string): Block[] {
  const src = stripComments(source);
  const starts: { at: number; callOpen: number; title: string | null; isCase: boolean }[] = [];
  // How far a title already read reaches. A block start inside one is prose:
  // `the setter never checks it (tile_map.cpp:996)` opens a block exactly the
  // way `SOME_RE.test(` does, and truncates the block it sits in.
  let readThrough = 0;
  for (const m of src.matchAll(BLOCK_START_RE)) {
    if (m.index < readThrough) continue;
    const open = m.index + m[0].length - 1;
    // `it.each(<table>)(<title>, …)`: the title sits in the second call, so
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
  const claimAt = (index: number): string =>
    body.slice(index, index + CLAIM_REACH).split(';')[0]!;
  for (const m of body.matchAll(TIER_HELPER_RE)) tiers.add(m[1]!.toLowerCase());
  for (const m of body.matchAll(TIER_LIST_RE)) {
    if (NON_EMPTY_RE.test(claimAt(m.index))) tiers.add(m[1]!);
  }
  for (const anchor of body.matchAll(TIER_ANCHOR_RE)) {
    const claim = claimAt(anchor.index);
    if (EXCLUDES_RE.test(claim)) continue;
    for (const m of claim.matchAll(TIER_LITERAL_RE)) tiers.add(m[1]!);
  }
  return [...tiers];
};

/**
 * This file, excluded by path: its pins spell whole `it(…)` blocks as data,
 * which a scan would read as subjects.
 */
const SELF = 'linter/testTitleTier.guard.test.ts';

const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/**
 * Scope is `it` and `test` blocks under this package's `src`: a `describe` may
 * cover children that disagree, a negative assertion naming no severity asserts
 * no tier, and the host apps sit outside the walk. A block that builds a
 * `LintRule` fixture is skipped, since its `severity:` is the value under test.
 */
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
    // The scrape's floor counts blocks, but this guard checks only those with
    // exactly one tier, so a narrowed anchor drops subjects with the walk
    // intact. That population's floor sits here.
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
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => [b.title, assertedTiers(b.body)])).toEqual([
      ['a', []],
      ['b', []],
    ]);
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
