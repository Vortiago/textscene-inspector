/**
 * Every numeric or enum bound says where its authority comes from. ADR-0032: a bound is an error only where Godot's
 * setter refuses or alters the value, and a warning where `PROPERTY_HINT_RANGE` states it but the setter assigns. The `v`
 * DSL records which, with the governing `file:line`, through `enforced:` / `hinted:`. The unclassified count only goes
 * down. What the two tiers do to a diagnostic's severity is in the sibling `boundGrounding.tiers.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import {
  isUnclassified,
  rangeWithoutTiers,
  staleUngroundable,
  unclassifiedKeys,
} from './testing/validatorClassification.js';
import './index.js'; // side-effect: every slice registers its validators
import { ENGINE_CITE_RE } from './testing/engineCite.js';
import { everyValidatorLabel, registeredKeys, registeredTypes } from './registryPopulation.js';

/**
 * Unclassified validators allowed, and it only shrinks: classify the validator instead. A `v` DSL validator is a `shape`
 * (rejects only malformed input) or takes a `Grounding`; a hand-rolled one is neither until its author says which. Since
 * `ground()` sets `bounded` or `formatOnly`, never both, "bounded and ungrounded" is exactly "neither formatOnly nor
 * grounding", so one walk covers it.
 */
const UNCLASSIFIED_VALIDATOR_BUDGET = 0;

/**
 * A grounding whose cite names no engine location. It rides the shared walk rather than a private recursion, which
 * would diverge from `unclassifiedKeys`'. The walk reaches leaves because a wildcard dispatcher's own tag vouches for
 * nothing behind it.
 */
const citesNoEngineLocation = (validator: PropertyValidator): boolean =>
  validator.grounding !== undefined && !ENGINE_CITE_RE.test(validator.grounding.cite);

describe('bound grounding', () => {
  it('states an out-of-range severity wherever it states a range', () => {
    // The two travel together into one sheet row, so a range beside an empty `Out of range` cell tells a reader the
    // bound has no consequence. A validator built from an inline arrow can carry an enforced floor and a hinted ceiling
    // with no tag.
    expect(rangeWithoutTiers()).toEqual([]);
  });

  it('classifies every validator as format-only or grounded', () => {
    // The floor first: a budget of zero is satisfied just as well by a registry that never loaded. It covers
    // hand-rolled validators too: one outside the DSL declares neither tag, so it lands here.
    expect(registeredKeys().length).toBeGreaterThan(1500);
    expect(unclassifiedKeys()).toHaveLength(UNCLASSIFIED_VALIDATOR_BUDGET);
  });

  it('holds no UNGROUNDABLE entry that exempts nothing', () => {
    // The budget above reads zero whether the named validator is still there or
    // not, so without this the exemption outlives its subject and pre-forgives
    // whatever is registered under that label next.
    expect(staleUngroundable()).toEqual([]);
  });

  it('gives every grounded bound a source citation', () => {
    // `enforced` without a `file:line` is the unverifiable claim an invented threshold makes. The floor rides on the
    // walk (2000 validators examined, none uncited): a separate key count could pass while the walk examined nothing.
    expect(everyValidatorLabel(citesNoEngineLocation, { atLeast: 2000 })).toEqual([]);
  });
});

describe('the classification guard bites', () => {
  /**
   * The predicate the registry walk applies, on a single validator. The shared one, not a local copy, so this guard
   * tests the rule the registry applies.
   */
  const unclassified = isUnclassified;

  it('catches a hand-rolled validator that declares neither', () => {
    // The shape `GPUParticles3D.visibility_aabb` had: a bare function rejecting
    // a real value, invisible to the bound ratchet because nothing set `bounded`.
    const handRolled: PropertyValidator = () => null;
    expect(unclassified(handRolled)).toBe(true);
  });

  it('passes a shape combinator, which rejects only malformed input', () => {
    for (const validator of [
      v.boolean('flat'),
      v.color('modulate'),
      v.aabb('visibility_aabb'),
      v.nodePath('remote_path'),
      v.quotedString('text'),
      v.vector3('position'),
    ]) {
      expect(validator.formatOnly).toBe(true);
      expect(unclassified(validator)).toBe(false);
    }
  });

  it('treats an unbounded FLOAT combinator as format-only, but never an int one', () => {
    // `v.float('width')` rejects only what is not a number, so there is no bound to cite. An int slot rejects a
    // non-finite, which the parser reads and the write then converts (variant.h:369-370), so it owes a citation.
    expect(v.float('width').formatOnly).toBe(true);
    expect(v.int('count').formatOnly).toBeUndefined();
    expect(v.int('count').intSlot).toEqual({ cite: 'variant.h:360-377', width: 'int32' });
    expect(
      v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' }).formatOnly
    ).toBeUndefined();
  });

  it('lets the int-slot tag classify an UNBOUNDED int, and never a bounded one', () => {
    // The slot's refusal is one central claim; a range is a per-property one.
    // While `markIntSlot` filled `grounding`, an uncited `v.strictInt('s', {min,
    // max})` reported its range at error tier and the ratchet never saw it.
    expect(unclassified(v.strictInt('s'))).toBe(false);
    expect(unclassified(v.strictInt('s', { min: 0, max: 9 }))).toBe(true);
    expect(unclassified(v.enumInt('mode', 0, 5, { 0: 'A' }))).toBe(true);
    expect(unclassified(v.strictInt('s', { min: 0, max: 9, hinted: 'node.cpp:1' }))).toBe(false);
  });

  it('passes a grounded bound, which cites instead of declaring format-only', () => {
    const validator = v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' });
    expect(validator.formatOnly).toBeUndefined();
    expect(unclassified(validator)).toBe(false);
  });

  it('catches a bound whose grounding was left off', () => {
    expect(unclassified(v.float('fov', { min: 1, max: 179 }))).toBe(true);
  });

  it('reads the cite on a leaf, which the dispatcher above it does not vouch for', () => {
    // A dispatcher cites the guard that refuses an unresolvable index; the bound
    // on each sub-property lives in the leaf. Checking the dispatcher alone let
    // a leaf name the class reference instead of a setter and stay green.
    const leaf: PropertyValidator = () => null;
    leaf.grounding = { kind: 'hinted', cite: 'the class reference gives 0 to 1' };
    const dispatcher: PropertyValidator = () => null;
    dispatcher.grounding = { kind: 'enforced', cite: 'generic_6dof_joint_3d.cpp:120' };
    dispatcher.leaves = [leaf];

    expect(
      everyValidatorLabel(citesNoEngineLocation, {
        roots: [{ label: 'Generic6DOFJoint3D.linear_limit_x/*', validator: dispatcher }],
      })
    ).toEqual(['Generic6DOFJoint3D.linear_limit_x/*[0]']);
  });

  it('reports a shared leaf instance once, however many slots reach it', () => {
    // One leaf instance can back several sub-properties, so the walk must not
    // treat re-encountering it as a second defect.
    const leaf: PropertyValidator = () => null;
    leaf.grounding = { kind: 'enforced', cite: 'no file here' };
    const outer: PropertyValidator = () => null;
    outer.formatOnly = true;
    outer.leaves = [leaf, leaf];

    expect(
      everyValidatorLabel(citesNoEngineLocation, {
        roots: [{ label: 'Type.key/*', validator: outer }],
      })
    ).toEqual(['Type.key/*[0]']);
  });

  it('names an UNGROUNDABLE label that resolves to nothing, or to a grounded bound', () => {
    // Both ways an entry dies: its type or key goes away, or its validator gains the missing citation. The live control
    // is a scratch root: the ungrounded population is empty by policy, so against the registry alone every label is
    // stale and the arm that must not report would pass vacuously.
    const stillUngrounded: PropertyValidator = () => null;
    expect(
      staleUngroundable(
        new Set(['NoSuchType.no_such_key', 'HBoxContainer.vertical', 'Scratch.ungrounded']),
        [{ label: 'Scratch.ungrounded', validator: stillUngrounded }]
      )
    ).toEqual(['HBoxContainer.vertical', 'NoSuchType.no_such_key']);
  });

  it('puts removal-only types in the swept key list, not just in the registry', () => {
    // A type declaring a removal can register no validator of its own, so it is absent from
    // `registeredTypes('declaring')`. This asserts the key list the classification test consumes.
    const swept = registeredKeys().map(({ nodeType, key }) => `${nodeType}.${key}`);
    expect(registeredTypes('declaring')).not.toContain('HBoxContainer');
    expect(swept).toContain('HBoxContainer.vertical');
    expect(swept).toContain('VSplitContainer.vertical');
  });

  it('states the numbers wherever it states a tier', () => {
    // `ground()` sets `tiers` and `bounds` together, so one without the other is hand-rolled or half-forwarded. `tiers`
    // decides a bound's severity and `bounds` carries the numbers `hintImplementationParity` checks against Godot's hint,
    // so tiers alone enforce a range no guard can check. The floor rides on the walk: an offender filter expects `[]`,
    // so a walk that reached nothing looks clean.
    expect(
      everyValidatorLabel((val) => val.tiers !== undefined && val.bounds === undefined, {
        atLeast: 2000,
      })
    ).toEqual([]);
  });

  it('reaches removals, which getOwnKeys deliberately omits', () => {
    // HBoxContainer takes `vertical` away from BoxContainer. That refuses every
    // value of a key a scene can carry, so it needs the same citation a bound
    // does, and a walk over declarations alone would never look at it.
    const validator = validatorRegistry.declarationFor('HBoxContainer', 'vertical');
    expect(validatorRegistry.getOwnKeys('HBoxContainer')).not.toContain('vertical');
    expect(Object.keys(validatorRegistry.getOwnRemovals('HBoxContainer'))).toContain('vertical');
    expect(validator?.grounding).toEqual({ kind: 'enforced', cite: 'box_container.cpp:312' });
    expect(unclassified(validator!)).toBe(false);
  });
});
