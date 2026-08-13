/**
 * `isTypeUnknowable` has one definition, and the guard that keeps it that way.
 *
 * The test is three arms — an instanced node, a typeless heading, an override of
 * a node inside an instance — and a re-spelling that drops one is invisible: it
 * still compiles, still reads plausibly, and only goes wrong on a scene shape
 * the corpus happens not to contain. Two copies existed before this guard, and
 * the one missing `overridesExistingNode` warned about parents it could not see,
 * because `StrictTscnParser.ts:26` fills `type` from the `index` fallback and an
 * override heading therefore has a truthy type of `"0"`.
 *
 * Source text rather than behaviour, deliberately: the failure is a rule that
 * never runs on a shape nobody wrote a fixture for, so there is nothing to
 * observe until someone writes one.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { allSourceFiles, linterDir } from './testing/ruleNameScrape.js';

/** `src/`, the root every label below is relative to. */
const CORE_SRC = resolve(linterDir, '..');

/** The owner, plus the parser that SETS the flag it reads. */
const ALLOWED = new Set(['linter/parentType.ts', 'linter/StrictTscnParser.ts']);

/** `x.instance …` OR-ed with a negated `.type` — the shape of an inline re-spelling. */
const INLINE_DISJUNCTION = /\.instance\b[^\n]*\|\|[^\n]*!\s*\w+\.type\b|!\s*\w+\.type\b[^\n]*\|\|[^\n]*\.instance\b/;

function offenders(predicate: (source: string) => boolean): string[] {
  return allSourceFiles()
    .map((file) => ({ label: relative(CORE_SRC, file).replaceAll('\\', '/'), file }))
    .filter(({ label }) => !ALLOWED.has(label))
    .filter(({ file }) => predicate(readFileSync(file, 'utf8')))
    .map(({ label }) => label);
}

describe('the unknowable-type test has one spelling', () => {
  it('walks past the files it exempts, so the allowlist is doing work', () => {
    // Without this, a walk that reached neither allowed file would report an
    // empty offender list and pass while scanning nothing that matters.
    const scanned = allSourceFiles().map((f) => relative(CORE_SRC, f).replaceAll('\\', '/'));
    for (const allowed of ALLOWED) expect(scanned).toContain(allowed);
    expect(offenders(() => true).length).toBeGreaterThan(500);
  });

  it('leaves `overridesExistingNode` to parentType.ts', () => {
    // Reading the flag anywhere else means a second copy of the rule, and the
    // copies disagree about the other two arms.
    expect(offenders((s) => s.includes('overridesExistingNode'))).toEqual([]);
  });

  it('spells no inline instance-or-untyped disjunction', () => {
    expect(offenders((s) => INLINE_DISJUNCTION.test(s))).toEqual([]);
  });

  it('recognises the two spellings it exists to catch', () => {
    // Proven to bite before it is trusted: both are real code this guard was
    // written for, and a regex that matched neither would report clean forever.
    expect(INLINE_DISJUNCTION.test('const u = parent !== null && (parent.instance !== undefined || !parent.type);')).toBe(true);
    expect(INLINE_DISJUNCTION.test('return !node.type || Boolean(node.instance);')).toBe(true);
    // And does not fire on the parser reading the same attributes off a heading.
    expect(
      INLINE_DISJUNCTION.test(
        "type: heading.attributes.type || heading.attributes.index || heading.attributes.instance || '',"
      )
    ).toBe(false);
  });
});
