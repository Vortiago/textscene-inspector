/**
 * Every property-list route family in `propertyListRoutes.ts` resolves to a
 * validator, or is a named gap. `UNIMPLEMENTED_COUNT` is a ratchet like
 * `ownValidatorCoverage`'s `UNDECLARED`: each row it counts is a family a scene
 * can carry with no validation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { ROWS, type RouteRow } from './propertyListRoutes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/** Rows counted as a live gap; only ever moves down as one is fixed. */
const UNIMPLEMENTED_COUNT = 0;

type Verdict = RouteRow['verdict'];

function isValidated(verdict: Verdict): verdict is { validated: true } {
  return 'validated' in verdict;
}

function isUnimplemented(verdict: Verdict): verdict is { unimplemented: string } {
  return 'unimplemented' in verdict;
}

function isDeclined(
  verdict: Verdict
): verdict is { declined: 'no-storage-bit' | 'never-owned' | 'runtime-shaped'; because: string } {
  return 'declined' in verdict;
}

/**
 * Every registered parser slice that is `type` or descends from it, the
 * population `ownValidatorCoverage` sweeps. `descendsFrom` matches the type
 * itself, so a declaring class that is also a leaf (`BoneConstraint3D`) counts.
 */
function concreteDescendants(type: string): string[] {
  return nodeRegistry
    .getAllTypeNames()
    .filter((candidate) => descendsFrom(candidate, type))
    .sort();
}

const validatedRows = ROWS.filter((row): row is RouteRow & { verdict: { validated: true } } =>
  isValidated(row.verdict)
);
const unimplementedRows = ROWS.filter(
  (row): row is RouteRow & { verdict: { unimplemented: string } } => isUnimplemented(row.verdict)
);

describe('property-list route coverage', () => {
  it('covers the read population, MultiplayerSpawner excluded', () => {
    // A pin, not a ceiling: the population grows only when someone reads
    // another override and writes its row. It cannot prove the population is
    // complete, since nothing may scrape the engine to ask.
    const types = new Set(ROWS.map((row) => row.type));
    expect(types.size).toBe(39);
    expect(types.has('MultiplayerSpawner')).toBe(false);
  });

  it('classifies every row into exactly one verdict', () => {
    for (const row of ROWS) {
      const flags = [isValidated(row.verdict), isUnimplemented(row.verdict), isDeclined(row.verdict)];
      expect(flags.filter(Boolean), `${row.type} ${row.sample}`).toHaveLength(1);
    }
  });

  it('gives every declined row a reason', () => {
    for (const row of ROWS) {
      if (isDeclined(row.verdict)) {
        expect(row.verdict.because.length, `${row.type} ${row.sample}`).toBeGreaterThan(0);
      }
    }
  });

  describe.each(validatedRows)('$type $sample ($at)', (row) => {
    const descendants = concreteDescendants(row.type);

    it('reaches at least one concretely registered type', () => {
      expect(descendants.length, `${row.type} has no concrete registered descendant`).toBeGreaterThan(0);
    });

    it('resolves on the declaring type', () => {
      expect(validatorRegistry.findValidator(row.type, row.sample)).not.toBeNull();
    });

    it.each(descendants)('resolves on %s', (type) => {
      expect(validatorRegistry.findValidator(type, row.sample)).not.toBeNull();
    });
  });

  describe.each(unimplementedRows)('$type $sample ($at) is a live gap', (row) => {
    it('still resolves to no validator, so the row cannot go stale silently', () => {
      expect(validatorRegistry.findValidator(row.type, row.sample)).toBeNull();
    });
  });

  it('pins the unimplemented count, so it can only move by editing this file', () => {
    // Exact equality, not a ceiling: a fixed row and a new row both require
    // an edit to this constant.
    expect(unimplementedRows.length).toBe(UNIMPLEMENTED_COUNT);
  });
});
