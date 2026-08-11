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
import { baseChain } from './nodeBaseTypes.js';
import { ASYMMETRY_ALLOWLIST } from './propertyGrammarParityAllowlist.js';
import { checkParity, collectSlices } from './testing/propertyGrammarParityCheck.js';
import {
  extractNodeType,
  findLinterParserDirs,
  nodesRoot,
} from './testing/propertyGrammarParityScan.js';
import './index.js';

describe('property-grammar parity guard', () => {
  it('finds slice pairs to check (sanity: walk is not empty)', () => {
    expect(collectSlices().length).toBeGreaterThan(0);
  });

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
    const slicesByType = new Map(collectSlices().map((s) => [s.nodeType, s]));
    const staleSections: string[] = [];

    // A base class validates for its descendants without parsing anything of
    // its own (it reuses the base parser), so it has no parser.ts and never
    // appears in `collectSlices`. Its allowlist entry is still live: the
    // base-walk delivers those keys to every leaf below it, and one entry there
    // is what keeps a dozen identical leaf entries from existing.
    const validatingBases = new Set(
      collectSlices().flatMap((s) => baseChain(s.nodeType))
    );

    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      const slice = slicesByType.get(nodeType);
      if (!slice) {
        if (validatingBases.has(nodeType)) continue;
        // Node type no longer has a slice pair — allowlist entry is stale.
        staleSections.push(
          `${nodeType}: no parser.ts+linterParser.ts pair found, and no slice inherits from it`
        );
        continue;
      }

      // parserOnly keys should NOT have a validator; linterOnly keys should
      // NOT be read by the parser — otherwise the asymmetry has been fixed.
      for (const key of entry.parserOnly ?? []) {
        if (slice.validatorKeys.has(key)) {
          staleSections.push(`${nodeType}.parserOnly['${key}']: now has a validator — remove from allowlist`);
        }
      }
      for (const key of entry.linterOnly ?? []) {
        if (slice.parserProps.has(key)) {
          staleSections.push(`${nodeType}.linterOnly['${key}']: now read by the parser — remove from allowlist`);
        }
      }
      for (const key of entry.renderGap ?? []) {
        if (slice.parserProps.has(key)) {
          staleSections.push(
            `${nodeType}.renderGap['${key}']: now read by the parser — the gap closed, remove from allowlist`
          );
        }
      }
    }

    expect(staleSections, `Stale allowlist entries found:\n  ${staleSections.join('\n  ')}`).toEqual([]);
  });

  it('no key is claimed as both deliberate scope and a render gap', () => {
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
  // number rather than a pile. Exact equality, not a ceiling: this list should
  // only move when someone deliberately adds a slice or closes a gap, and
  // either way the diff should say so out loud.
  // +9 on Light3D, then +38 across Label3D, Line2D, Polygon2D, GridMap, both
  // NavigationRegions, TileMapLayer, Sprite2D and Path3D.
  //
  // None of these are new gaps. The previewer never read any of them; they
  // became VISIBLE only once validators existed for the properties, because
  // this guard can only ask "should the renderer be reading this?" about a key
  // one side already declares. The engine-property sweep that added those
  // validators is what surfaced them, so the number rising here is the
  // to-do list becoming honest rather than growing.
  const EXPECTED_RENDER_GAP_KEYS = 95;

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
   * Closing it means keying the population on `linterParser.ts` alone and
   * resolving the parser side through `getInheritedParserProps`. The blocker is
   * NOT the lookup table: walking `NODE_BASE_TYPES` for every slice in this set
   * shows only nine distinct ancestors cover all of them, and the table above now
   * has all nine, so nothing would over-report for want of a hop. (An earlier
   * version of this note claimed the table needed extending "well past its
   * current few hops"; that was wrong, and the four entries it implied were a
   * project have since been added.)
   *
   * What remains is real but is classification work, not plumbing: admitting the
   * whole set at once surfaces every asymmetry it was never asked about, and each
   * one needs the honest `linterOnly` vs `renderGap` call that only a reading of
   * the property can give. That is the piece of work, and it wants its own pass
   * rather than being smuggled into a wave.
   */
  const SWEPT_SLICES = 74;
  // +1: nodes/animation/animationmixer/ — a new abstract tier (linterParser.ts
  // only, no parser.ts of its own, same shape as canvasitem/shared/), added to
  // register anims/<name>/libraries/libraries/<name> once for both
  // AnimationPlayer and AnimationTree rather than duplicating the three
  // validators across both concrete slices.
  const PARSER_REUSING_SLICES = 173;

  it('accounts for every linterParser.ts, swept or knowingly not', () => {
    const withLinterParser = findLinterParserDirs(nodesRoot).filter((dir) =>
      extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'))
    );
    expect(collectSlices()).toHaveLength(SWEPT_SLICES);
    expect(
      withLinterParser.length - collectSlices().length,
      'Slices outside this guard changed. Update the count, and say in the commit ' +
        'whether the new ones are base-parser reusers (expected) or are missing a parser.ts they should have.'
    ).toBe(PARSER_REUSING_SLICES);
  });
});
