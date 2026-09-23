/**
 * Property-grammar parity: for each slice with `parser.ts` and `linterParser.ts`,
 * the keys the parser reads through `properties.X` match the validator keys, each
 * side widened by its base types. A parser-only key lacks a validator, and a
 * linter-only key is never read, unless `ASYMMETRY_ALLOWLIST` lists it with a reason.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseChain } from '../godot/nodeBaseTypes.js';
import { ASYMMETRY_ALLOWLIST, type AsymmetryEntry } from './propertyGrammarParityAllowlist.js';
import { checkParity, collectSlices, getFullValidatorKeys } from './testing/propertyGrammarParityCheck.js';
import {
  extractNodeType,
  findLinterParserDirs,
  nodesRoot,
} from './testing/propertyGrammarParityScan.js';
import './index.js';

/** One slice as the staleness scan sees it: the type it speaks for, and the keys its parser reads. */
interface SliceReads {
  nodeType: string;
  parserProps: ReadonlySet<string>;
}

interface StaleScanInput {
  allowlist: Readonly<Record<string, AsymmetryEntry>>;
  slices: readonly SliceReads[];
  baseChainOf: (nodeType: string) => readonly string[];
  validatorKeysOf: (nodeType: string) => ReadonlySet<string>;
}

/**
 * The allowlist entries that no longer describe a live asymmetry. It takes its
 * world as arguments, so the seeded partial-closure cases settle `.every()`
 * versus `.some()`, not the tree's content.
 */
function findStaleEntries({
  allowlist,
  slices,
  baseChainOf,
  validatorKeysOf,
}: StaleScanInput): string[] {
  const staleSections: string[] = [];
  // An entry answers for its own slice and every slice below it: a base class
  // reuses the base parser, has no parser.ts, and is absent from `collectSlices`.
  const coveredSlices = (nodeType: string) =>
    slices.filter((s) => s.nodeType === nodeType || baseChainOf(s.nodeType).includes(nodeType));

  for (const [nodeType, entry] of Object.entries(allowlist)) {
    const covered = coveredSlices(nodeType);
    if (covered.length === 0) {
      // Node type has no slice pair, so the allowlist entry is stale.
      staleSections.push(
        `${nodeType}: no parser.ts+linterParser.ts pair found, and no slice inherits from it`
      );
      continue;
    }

    // The asymmetry closes once every slice the entry answers for reads the
    // key, so a base covering many slices reports only when the last closes.
    // Narrowing it to the leaves that still need it is an allowlist edit.
    const readEverywhere = (key: string) => covered.every((s) => s.parserProps.has(key));
    // Validators resolve up the base chain with no slice needed, so this is
    // the same set a slice of this type would carry.
    const validatorKeys = validatorKeysOf(nodeType);

    // A parserOnly key with a validator, or a linterOnly key the parser reads,
    // is a fixed asymmetry.
    for (const key of entry.parserOnly ?? []) {
      if (validatorKeys.has(key)) {
        staleSections.push(`${nodeType}.parserOnly['${key}']: now has a validator — remove from allowlist`);
      }
    }
    for (const key of entry.linterOnly ?? []) {
      if (readEverywhere(key)) {
        staleSections.push(`${nodeType}.linterOnly['${key}']: now read by the parser — remove from allowlist`);
      }
    }
    for (const key of entry.renderGap ?? []) {
      if (readEverywhere(key)) {
        staleSections.push(
          `${nodeType}.renderGap['${key}']: now read by the parser — the gap closed, remove from allowlist`
        );
      }
    }
  }

  return staleSections;
}

describe('property-grammar parity guard', () => {
  it('every slice pair has symmetric property coverage (or an allowlisted asymmetry)', () => {
    const violations = checkParity();

    const lines: string[] = ['Unapproved parser/validator asymmetries:'];
    for (const v of violations) {
      lines.push(`\n  ${v.slice} [${v.nodeType}]:`);
      if (v.parserOnlyNotAllowlisted.length > 0)
        lines.push(`    parser-only (no validator): ${v.parserOnlyNotAllowlisted.join(', ')}`);
      if (v.linterOnlyNotAllowlisted.length > 0)
        lines.push(`    linter-only (no parser read): ${v.linterOnlyNotAllowlisted.join(', ')}`);
      lines.push(`    → add to ASYMMETRY_ALLOWLIST['${v.nodeType}'] with a reason, or fix the desync.`);
    }
    expect(violations, lines.join('\n')).toEqual([]);
  });

  it('allowlist entries stay honest: every listed key is genuinely asymmetric', () => {
    const staleSections = findStaleEntries({
      allowlist: ASYMMETRY_ALLOWLIST,
      slices: collectSlices(),
      baseChainOf: baseChain,
      validatorKeysOf: getFullValidatorKeys,
    });

    expect(staleSections, `Stale allowlist entries found:\n  ${staleSections.join('\n  ')}`).toEqual([]);
  });

  /**
   * The staleness verdict on seeded slices. Without a live split in the tree,
   * `.every()` and `.some()` agree on every entry, so these cases own the
   * semantics: a partly-closed key still has work to do, a fully-closed one does not.
   */
  describe('staleness verdict on seeded slices', () => {
    const BASE = 'ScratchBase';
    const CLOSER = 'ScratchCloser'; // a descendant whose parser reads the key
    const LAGGARD = 'ScratchLaggard'; // a descendant whose parser does not
    const KEY = 'scratch_key';
    const reason = 'seeded';

    const CHAINS: Readonly<Record<string, readonly string[]>> = {
      [CLOSER]: [BASE],
      [LAGGARD]: [BASE],
      Unrelated: [],
    };
    const noValidators = () => new Set<string>();

    const scan = (
      reads: Readonly<Record<string, readonly string[]>>,
      entry: AsymmetryEntry,
      validatorKeysOf: (nodeType: string) => ReadonlySet<string> = noValidators
    ) =>
      findStaleEntries({
        allowlist: { [BASE]: entry },
        slices: Object.entries(reads).map(([nodeType, keys]) => ({
          nodeType,
          parserProps: new Set(keys),
        })),
        baseChainOf: (nodeType) => CHAINS[nodeType] ?? [],
        validatorKeysOf,
      });

    const PARTIAL = { [CLOSER]: [KEY], [LAGGARD]: [] };
    const CLOSED = { [CLOSER]: [KEY], [LAGGARD]: [KEY] };
    const OPEN = { [CLOSER]: [], [LAGGARD]: [] };

    it('partial closure keeps a linterOnly entry alive — the laggard still needs it', () => {
      expect(scan(PARTIAL, { linterOnly: [KEY], reason })).toEqual([]);
    });

    it('partial closure keeps a renderGap entry alive', () => {
      expect(scan(PARTIAL, { renderGap: [KEY], reason })).toEqual([]);
    });

    it('no descendant reading the key keeps the entry alive', () => {
      expect(scan(OPEN, { renderGap: [KEY], reason })).toEqual([]);
    });

    it('full closure reports a linterOnly entry stale', () => {
      expect(scan(CLOSED, { linterOnly: [KEY], reason })).toEqual([
        `${BASE}.linterOnly['${KEY}']: now read by the parser — remove from allowlist`,
      ]);
    });

    it('full closure reports a renderGap entry stale', () => {
      expect(scan(CLOSED, { renderGap: [KEY], reason })).toEqual([
        `${BASE}.renderGap['${KEY}']: now read by the parser — the gap closed, remove from allowlist`,
      ]);
    });

    it('a slice outside the entry’s subtree does not vote, in either direction', () => {
      const entry: AsymmetryEntry = { renderGap: [KEY], reason };
      // Abstaining outsider cannot keep a closed entry alive.
      expect(scan({ ...CLOSED, Unrelated: [] }, entry)).toEqual([
        `${BASE}.renderGap['${KEY}']: now read by the parser — the gap closed, remove from allowlist`,
      ]);
      // Reading outsider cannot close it either.
      expect(scan({ [LAGGARD]: [], Unrelated: [KEY] }, entry)).toEqual([]);
    });

    it('a parserOnly key is stale exactly when a validator exists', () => {
      const entry: AsymmetryEntry = { parserOnly: [KEY], reason };
      expect(scan(OPEN, entry)).toEqual([]);
      expect(scan(OPEN, entry, () => new Set([KEY]))).toEqual([
        `${BASE}.parserOnly['${KEY}']: now has a validator — remove from allowlist`,
      ]);
    });

    it('an entry no slice answers for is stale', () => {
      expect(scan({}, { linterOnly: [KEY], reason })).toEqual([
        `${BASE}: no parser.ts+linterParser.ts pair found, and no slice inherits from it`,
      ]);
    });
  });

  it('every allowlisted key is a key some side actually declares', () => {
    // The honesty check above never asks whether a listed key exists, so a
    // typo would inflate the render-gap count with a property Godot never had.
    // Wildcards are patterns rather than keys, so they are exempt by shape.
    const unknown: string[] = [];
    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      // Inherited keys count: an entry sits on the type whose parser is silent
      // about them, which is routinely a descendant of the type that declares
      // them (Control lists CanvasItem's z_index, and rightly).
      const declared = new Set([
        ...getFullValidatorKeys(nodeType),
        ...(collectSlices().find((s) => s.nodeType === nodeType)?.parserProps ?? []),
      ]);
      const listed = [
        ...(entry.parserOnly ?? []),
        ...(entry.linterOnly ?? []),
        ...(entry.renderGap ?? []),
      ];
      for (const key of listed) {
        if (key.includes('*') || key.includes('#')) continue;
        if (!declared.has(key)) unknown.push(`${nodeType}.${key}`);
      }
    }
    expect(
      unknown,
      `Allowlisted keys that neither the validators nor the parser declare, so they describe nothing:\n  ${unknown.join('\n  ')}`
    ).toEqual([]);
  });

  it('no key is claimed as both deliberate scope and a render gap', () => {
    // Two kinds only: a pre-4.0 spelling is canonicalised before either side
    // sees it and has no validator of its own, so no alias category exists.
    const conflicts: string[] = [];
    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      const deliberate = new Set(entry.linterOnly ?? []);
      for (const key of entry.renderGap ?? []) {
        if (deliberate.has(key)) conflicts.push(`${nodeType}: '${key}'`);
      }
    }
    expect(
      conflicts,
      `A key is either out of render scope or a gap, never both:\n  ${conflicts.join('\n  ')}`
    ).toEqual([]);
  });

  // The render-gap surface is the previewer's to-do list, pinned by exact
  // equality: it moves only when a slice is added or a gap closes. A new
  // validator makes an unread key visible, so a rise usually means the list
  // became honest.
  const EXPECTED_RENDER_GAP_KEYS = 130;

  it('the render-gap surface matches its recorded size', () => {
    const gaps = Object.entries(ASYMMETRY_ALLOWLIST).flatMap(([nodeType, entry]) =>
      (entry.renderGap ?? []).map((key) => `${nodeType}.${key}`)
    );
    expect(
      gaps.length,
      `Render gaps now number ${gaps.length}, not ${EXPECTED_RENDER_GAP_KEYS}:\n  ${gaps.join('\n  ')}`
    ).toBe(EXPECTED_RENDER_GAP_KEYS);
  });

  /**
   * Slices this guard does not see, counted so the blind spot moves visibly:
   * `findSliceDirs` needs both `parser.ts` and `linterParser.ts`, and a slice
   * that reuses a base parser has no `parser.ts`. Where the question has an
   * answer, the fix is a hop in `BASE_TYPE_TO_PARSER_SUBPATH`.
   */
  // Both are ratchets, not derived, or the assertion compares a number to
  // itself. A transform-only type draws nothing, and a `pending` type is one
  // gap `renderIntent` already declares, so neither widens the population.
  const SWEPT_SLICES = 104;
  const PARSER_REUSING_SLICES = 147;

  it('accounts for every linterParser.ts, swept or knowingly not', () => {
    const withLinterParser = findLinterParserDirs(nodesRoot).filter((dir) =>
      extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'))
    );
    // Doubles as the population floor: an empty walk fails here, and in the
    // honesty check, which would call every allowlist entry stale.
    expect(collectSlices()).toHaveLength(SWEPT_SLICES);
    expect(
      withLinterParser.length - collectSlices().length,
      'Slices outside this guard changed. Update the count, and say in the commit ' +
        'whether the new ones are base-parser reusers (expected) or are missing a parser.ts they should have.'
    ).toBe(PARSER_REUSING_SLICES);
  });
});
