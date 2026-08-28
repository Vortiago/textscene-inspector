/**
 * A refusal that never looked at the value must say so on the ERROR.
 *
 * `StrictTscnParser` rewrites a validator's message when the value is a bare
 * `null`, because NIL converts strictly only to OBJECT and every other slot
 * takes the type's zero. That claim is false for a refusal of the KEY: there is
 * no slot to store a zero in, so the rewrite replaces the real reason and
 * downgrades a dropped write to a warning.
 *
 * The flag rides on the ERROR, because `findValidator` returns a family's
 * dispatcher rather than the leaf that refused. This guard asks the population
 * directly rather than trusting a grep: key refusals are spelled as raw object
 * literals and behind leaves, where no `propertyError(` search reaches them.
 *
 * A refusal counts as value-independent when a diverse value set draws the
 * identical message and code. A validator that echoes the offending value —
 * every `v` bound does — varies its message and is never considered here.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import { ownsNilMessage } from './propertyValidator.js';
import type { PropertyValidator } from './propertyValidator.js';
import './index.js'; // side-effect: every slice registers its validators

/** Spans the Variant forms a `.tscn` can put in any slot. */
const VALUES = [
  '"guard"',
  'null',
  '1',
  '-1',
  '1.5',
  'true',
  'Vector2(1, 2)',
  'Vector3(1, 2, 3)',
  'Color(1, 1, 1, 1)',
  'SubResource("Guard_1")',
];

/** A leaf name no Godot class declares, so any refusal of it is key-level. */
const BOGUS = '__guard_bogus__';

/**
 * Concrete keys to probe for one registered key pattern. Wildcards are the four
 * shapes `buildWildcardIndex` recognises; anything else is an exact key.
 */
function probeKeys(pattern: string): string[] {
  if (pattern.endsWith('#/**')) {
    const p = pattern.slice(0, -4);
    return [`${p}0/${BOGUS}`, `${p}-1/${BOGUS}`, `${p}0/joints/0/${BOGUS}`];
  }
  if (pattern.endsWith('#/*')) {
    const p = pattern.slice(0, -3);
    return [`${p}0/${BOGUS}`, `${p}-1/${BOGUS}`];
  }
  if (pattern.endsWith('/*')) {
    // A `prefix/*` family often carries its index BELOW the wildcard
    // (`bones/0/position`), so the bare leaf probe alone never reaches the
    // branch that resolves an index.
    const p = pattern.slice(0, -2);
    return [`${p}/${BOGUS}`, `${p}/0/${BOGUS}`, `${p}/-1/${BOGUS}`, `${p}/-1/name`];
  }
  if (pattern.endsWith('#')) {
    const p = pattern.slice(0, -1);
    return [`${p}0`, `${p}-1`];
  }
  return [pattern];
}

interface Offender {
  nodeType: string;
  key: string;
  message: string;
}

/**
 * Whether `probe` refuses `key` the same way whatever the value, and if so
 * whether that refusal declares itself. `owner` is the validator the REGISTRY
 * hands the seam — a leaf's own flag never reaches it, so a leaf is judged
 * against its dispatcher's exemption and its own error's.
 */
function offence(
  nodeType: string,
  key: string,
  probe: PropertyValidator,
  owner: PropertyValidator
): Offender | null {
  const errors = VALUES.map((value) => probe(key, value, 1));
  const first = errors[0];
  if (!first) return null;
  const uniform = errors.every((e) => e && e.message === first.message && e.code === first.code);
  if (!uniform) return null;
  if (ownsNilMessage(owner, first)) return null;
  return { nodeType, key, message: first.message };
}

function sweep(): Offender[] {
  const offenders: Offender[] = [];
  for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
    for (const pattern of validatorRegistry.getOwnKeys(nodeType)) {
      for (const key of probeKeys(pattern)) {
        const validator = validatorRegistry.findValidator(nodeType, key);
        if (!validator) continue;

        const found = offence(nodeType, key, validator, validator);
        if (found) offenders.push(found);

        // Past the dispatcher: a family's leaf carries its own `keyVerdict`,
        // but `findValidator` returns the dispatcher, so only the error the
        // leaf builds can reach the seam.
        for (const leaf of validator.leaves ?? []) {
          const leafFound = offence(nodeType, key, leaf, validator);
          if (leafFound) offenders.push(leafFound);
        }
      }
    }
  }
  return offenders;
}

describe('key-shape refusals declare themselves on the error', () => {
  it('every value-independent refusal carries keyVerdict', () => {
    const offenders = sweep();
    const report = offenders
      .map((o) => `  ${o.nodeType} :: ${o.key}\n    ${o.message}`)
      .join('\n');
    expect(
      offenders,
      `A refusal that draws the same message for every value never read the ` +
        `value, so StrictTscnParser's nil rewrite must not replace it. Build ` +
        `it with keyShapeError (or tag the leaf's error keyVerdict):\n${report}`
    ).toEqual([]);
  });

  it('sees a refusal that forgets the flag', () => {
    // The guard is only worth its runtime if it fails on the shape it bans, so
    // the ban is exercised against a validator written the wrong way.
    const unflagged = (key: string, _value: string, line: number) => ({
      severity: 'error' as const,
      message: `Unknown ${key}`,
      line,
      column: key.length + 3,
      code: 'GUARD_PROBE',
    });
    const errors = VALUES.map((value) => unflagged('bogus', value, 1));
    const uniform = errors.every((e) => e.message === errors[0]!.message);
    expect(uniform).toBe(true);
    expect(ownsNilMessage(unflagged, errors[0]!)).toBe(false);
    expect(errors[0]).not.toHaveProperty('keyVerdict');
  });
});
