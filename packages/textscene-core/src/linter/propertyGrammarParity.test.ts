/**
 * Property-grammar parity guard.
 *
 * For every slice that has both `parser.ts` and `linterParser.ts`, asserts
 * that the set of property names read by the parser (via `properties.X`)
 * matches the set of validator keys registered for that node type.
 *
 * Each side is augmented by the inherited set its ancestor contributes:
 *   - Validator keys: walk NODE_BASE_TYPES and collect each base type's
 *     own registered keys via `validatorRegistry.getOwnKeys()`.
 *   - Parser properties: walk NODE_BASE_TYPES and scrape each base type's
 *     `parser.ts` file for `properties.X` accesses.
 *
 * Legitimate asymmetries are recorded in ASYMMETRY_ALLOWLIST below.  Every
 * entry carries a one-line justification and doubles as the inventory that
 * feeds the descriptor-DSL pilot design.
 *
 * Desync detection:
 *   - A parser-only key not in the allowlist means a property was added to
 *     `parser.ts` but the matching validator was never registered.
 *   - A linter-only key not in the allowlist means a validator key was added
 *     to `linterParser.ts` but the parser never reads it (potential dead
 *     validator if the property is also not inherited).
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
 * The allowlist entries that no longer describe a live asymmetry.
 *
 * Takes its world as arguments so the quantifier below can be pinned on seeded
 * data. On the real tree it discriminates only because some descendants close a
 * base's key while their siblings do not — an accident of today's content, not a
 * property of the guard — so `.every()` vs `.some()` is settled by the seeded
 * partial-closure cases beside this guard, never by what the tree happens to hold.
 *
 * The slices an entry answers for: its own, plus every slice below it.
 *
 * A base class validates for its descendants without parsing anything of its
 * own (it reuses the base parser), so it has no parser.ts and never appears in
 * `collectSlices`. Asking only for its own slice therefore let a `continue` skip
 * the whole entry, and 89 keys across 9 base entries — all 32 Viewport gaps
 * among them — were never checked at all: closing one of those gaps moved
 * nothing. The entry is consulted up the base chain, so the slices below it are
 * exactly the population it speaks for.
 */
function findStaleEntries({
  allowlist,
  slices,
  baseChainOf,
  validatorKeysOf,
}: StaleScanInput): string[] {
  const staleSections: string[] = [];
  const coveredSlices = (nodeType: string) =>
    slices.filter((s) => s.nodeType === nodeType || baseChainOf(s.nodeType).includes(nodeType));

  for (const [nodeType, entry] of Object.entries(allowlist)) {
    const covered = coveredSlices(nodeType);
    if (covered.length === 0) {
      // Node type no longer has a slice pair — allowlist entry is stale.
      staleSections.push(
        `${nodeType}: no parser.ts+linterParser.ts pair found, and no slice inherits from it`
      );
      continue;
    }

    // The asymmetry has closed once EVERY slice the entry answers for reads
    // the key; one leaf reading it leaves the entry doing real work for the
    // rest. So a base covering many slices — CanvasItem 37, VisualInstance3D
    // 16, GeometryInstance3D 10 — only reports once the last of them closes,
    // and narrowing such an entry to the leaves that still need it is an edit
    // to the allowlist rather than to this guard.
    const readEverywhere = (key: string) => covered.every((s) => s.parserProps.has(key));
    // Validators resolve up the base chain with no slice needed, so this is
    // the same set a slice of this type would carry.
    const validatorKeys = validatorKeysOf(nodeType);

    // parserOnly keys should NOT have a validator; linterOnly keys should
    // NOT be read by the parser — otherwise the asymmetry has been fixed.
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
   * The staleness verdict, seeded rather than borrowed.
   *
   * On the real tree the quantifier bites only because of a live split —
   * MeshInstance3D closes VisualInstance3D's `layers` while its siblings do not.
   * Close that split either way and `.every()` and `.some()` agree on every
   * entry, so a weakening edit would pass in silence. These cases own the
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
    // The honesty check above asks whether a listed key has become symmetric.
    // It never asks whether the key EXISTS, so a typo or a leftover placeholder
    // sits in the table forever, silently inflating the render-gap count and
    // describing a property Godot never had. Caught for real: a placeholder
    // string survived a full review pass in the Viewport render-gap list purely
    // because nothing looked.
    //
    // Wildcards are patterns rather than keys, so they are exempt by shape.
    const unknown: string[] = [];
    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      // Inherited keys count: an entry sits on the type whose PARSER is silent
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

  // The render-gap surface is the previewer's honest to-do list, so it gets a
  // number rather than a pile. Exact equality, not a ceiling: it moves only when
  // someone deliberately adds a slice or closes a gap, and either way the diff
  // should say which.
  //
  // A rise is usually the list becoming honest rather than growing. This guard
  // can only ask "should the renderer be reading this?" about a key one side
  // already declares, so a key the previewer never read becomes VISIBLE the
  // moment a validator exists for it.
  const EXPECTED_RENDER_GAP_KEYS = 151;

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
   * Slices this guard does NOT see, counted so the blind spot moves visibly.
   *
   * `findSliceDirs` admits a directory only when it holds BOTH `parser.ts` and
   * `linterParser.ts`. Every slice that reuses a base parser has no `parser.ts`
   * of its own — ADR-0008's transform-only shape and the whole Control-reuse
   * pattern — so the guard's most valuable question, "is this validated key
   * something the renderer should be reading?", is never asked of them. All 28
   * skeleton slices are in this set.
   *
   * That is a real limitation, and the number is here because the alternative is
   * worse than the limitation: an untouched `ASYMMETRY_ALLOWLIST` reads as "the
   * new slices are symmetric" when it actually means "they were never examined".
   * A wave that adds ten base-reusing slices now moves a number and must say so.
   *
   * Widening the population wholesale is not the answer. For a transform-only
   * type Godot draws nothing, and for a `pending` one the whole type is a single
   * declared gap `renderIntent` already carries, so the per-key "should the
   * renderer read this?" question has nothing to answer on either — it would add
   * one allowlist row per key saying what `renderIntent` says once. Where the
   * question does have an answer and the slice reuses a family parser, the fix is
   * a hop in `BASE_TYPE_TO_PARSER_SUBPATH`, not a wider population.
   */
  // Both are ratchets, not derived: computing either side would make the
  // assertion below compare a number to itself. Moving one is a deliberate act
  // that belongs in a commit message — a slice entering the swept set, or a new
  // base-parser reuser entering the blind spot the docblock above sizes.
  const SWEPT_SLICES = 104;
  const PARSER_REUSING_SLICES = 147;

  it('accounts for every linterParser.ts, swept or knowingly not', () => {
    const withLinterParser = findLinterParserDirs(nodesRoot).filter((dir) =>
      extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'))
    );
    // Doubles as the population floor: an empty walk fails here, and again in
    // the honesty check, which would then call every allowlist entry stale.
    expect(collectSlices()).toHaveLength(SWEPT_SLICES);
    expect(
      withLinterParser.length - collectSlices().length,
      'Slices outside this guard changed. Update the count, and say in the commit ' +
        'whether the new ones are base-parser reusers (expected) or are missing a parser.ts they should have.'
    ).toBe(PARSER_REUSING_SLICES);
  });
});
