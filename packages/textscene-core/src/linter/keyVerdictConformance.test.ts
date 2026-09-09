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
import { everyValidator, registeredKeys } from './registryPopulation.js';
import { keyShapeError } from './validators/propertyError.js';
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

/** The one value the seam ever consults, so the one whose error is judged. */
const NIL = VALUES.indexOf('null');

/** A leaf name no Godot class declares, so any refusal of it is key-level. */
const BOGUS = '__guard_bogus__';

/**
 * Segments a family's `_set` matches BELOW its own index. A synthesised key
 * cannot guess a literal, so the branches that refuse a joint or a per-terrain
 * key are unreachable without naming them, and a bogus segment lands on the
 * enclosing family's unknown-leaf arm instead. The `every nested segment still
 * reaches a refusal` case fails when one goes stale.
 */
const NESTED_SEGMENTS = ['joints/0', 'joints/-1', 'terrain_0', 'terrain_-1'];

/** Probes for a family indexed at `base`, its nested branches included. */
function indexedProbes(base: string): string[] {
  return [
    `${base}0/${BOGUS}`,
    `${base}-1/${BOGUS}`,
    `${base}-1/name`,
    ...NESTED_SEGMENTS.flatMap((segment) => [
      `${base}0/${segment}/${BOGUS}`,
      `${base}-1/${segment}/${BOGUS}`,
    ]),
  ];
}

/**
 * Concrete keys to probe for one registered key pattern. Wildcards are the four
 * shapes `buildWildcardIndex` recognises; anything else is an exact key, which
 * covers every removal too.
 */
function probeKeys(pattern: string): string[] {
  if (pattern.endsWith('#/**')) return indexedProbes(pattern.slice(0, -4));
  if (pattern.endsWith('#/*')) return indexedProbes(pattern.slice(0, -3));
  if (pattern.endsWith('/*')) {
    // A `prefix/*` family often carries its index BELOW the wildcard
    // (`bones/0/position`), so the bare leaf probe alone never reaches the
    // branch that resolves an index.
    const p = pattern.slice(0, -2);
    return [`${p}/${BOGUS}`, ...indexedProbes(`${p}/`)];
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
 * whether that refusal declares itself. The verdict is read off the ERROR, the
 * one object that survives a dispatcher and a wrapper alike, so a leaf is
 * judged on what it actually returns.
 */
function offence(nodeType: string, key: string, probe: PropertyValidator): Offender | null {
  const errors = VALUES.map((value) => probe(key, value, 1));
  const first = errors[0];
  if (!first) return null;
  const uniform = errors.every((e) => e && e.message === first.message && e.code === first.code);
  if (!uniform) return null;
  // The nil error, not the first: the rewrite this guards runs on that one
  // alone, and a branch may build the same message twice by two routes.
  if (ownsNilMessage(errors[NIL]!)) return null;
  return { nodeType, key, message: first.message };
}

/** Offenders, and the subject counts that say the sweep had subjects. */
function sweep(): { offenders: Offender[]; probes: number; exempt: number } {
  const offenders: Offender[] = [];
  let probes = 0;
  let exempt = 0;

  // One walk per PROBE KEY, each with its own dedupe scope. That scope is the
  // whole difference from every other sweep here: the question is what
  // `ParseError` a KEY produces, so a leaf instance shared between dispatchers
  // must be revisited under each key that reaches it, not reported once.
  // `everyValidator`'s injected-roots seam gives exactly that — one execution,
  // one set — without a hand-rolled recursion that can drift from the shared one.
  //
  // `registeredKeys`, not `getOwnKeys`: removals are the third population and a
  // removal-only type never appears in the validator map at all.
  for (const { nodeType, key: pattern } of registeredKeys()) {
    for (const key of probeKeys(pattern)) {
      const validator = validatorRegistry.findValidator(nodeType, key);
      if (!validator) continue;
      for (const { validator: reached } of everyValidator(() => true, {
        roots: [{ label: `${nodeType}.${key}`, validator }],
      })) {
        probes++;
        const found = offence(nodeType, key, reached);
        if (found) offenders.push(found);
        // The exemption arm firing is what says the sweep still reaches
        // refusals: an empty registry drives `probes` and `exempt` to zero.
        const nilError = reached(key, 'null', 1);
        if (nilError && ownsNilMessage(nilError)) exempt++;
      }
    }
  }
  return { offenders, probes, exempt };
}

describe('key-shape refusals declare themselves on the error', () => {
  it('every value-independent refusal carries keyVerdict', () => {
    const { offenders } = sweep();
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

  it('sweeps a population that cannot quietly empty', () => {
    const { probes, exempt } = sweep();
    expect(probes).toBeGreaterThan(3000);
    expect(exempt).toBeGreaterThan(200);
  });

  it('every nested segment still reaches a refusal', () => {
    for (const segment of NESTED_SEGMENTS) {
      const reached = registeredKeys().some(({ nodeType, key: pattern }) =>
        probeKeys(pattern)
          .filter((key) => key.includes(`/${segment}/`))
          .some((key) => {
            const validator = validatorRegistry.findValidator(nodeType, key);
            const error = validator?.(key, 'null', 1);
            return error?.keyVerdict === true;
          })
      );
      expect(reached, `no family refuses a key below "${segment}"`).toBe(true);
    }
  });

  it('sees a refusal that forgets the flag, and clears one that carries it', () => {
    // The guard is only worth its runtime if it fails on the shape it bans, so
    // `offence` itself is run against a validator written each way.
    const unflagged: PropertyValidator = (key, _value, line) => ({
      severity: 'error' as const,
      message: `Unknown ${key}`,
      line,
      column: key.length + 3,
      code: 'GUARD_PROBE',
    });
    const flagged: PropertyValidator = (key, _value, line) =>
      keyShapeError(key, line, `Unknown ${key}`, 'GUARD_PROBE');
    expect(offence('Guard', BOGUS, unflagged)).not.toBeNull();
    expect(offence('Guard', BOGUS, flagged)).toBeNull();
  });
});
