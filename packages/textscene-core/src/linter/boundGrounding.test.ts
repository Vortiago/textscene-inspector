/**
 * Every numeric or enum bound must say where its authority comes from.
 *
 * ADR-0032: a bound is an ERROR only where Godot's setter refuses or alters the
 * value, and a WARNING where the property's `PROPERTY_HINT_RANGE` states it but
 * the setter assigns straight through. The `v` DSL records which, along with the
 * governing `file:line`, via `enforced:` / `hinted:`.
 *
 * A bound with neither is un-audited. It behaves as it always has (an error),
 * which is right for some and wrong for others, and the only way to know is to
 * read the setter. This is the ratchet over that migration: the count of
 * un-audited bounds goes down and never up, so a new slice cannot quietly add
 * one, and the number reaching zero is what finishes the audit.
 *
 * The two tiers' own behaviour — what `enforced` and `hinted` do to a
 * diagnostic's severity — is the sibling `boundGrounding.tiers.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import {
  classifiableKeys,
  isUnclassified,
  rangeWithoutTiers,
  staleUngroundable,
  sweepValidators,
  unclassifiedKeys,
} from './testing/validatorClassification.js';
import './index.js'; // side-effect: every slice registers its validators
import { ENGINE_CITE_RE } from './testing/engineCite.js';

/**
 * Types whose validators are all still unclassified.
 *
 * A validator built through the `v` DSL is classified by construction: every
 * combinator is either a `shape` (rejects only malformed input, so it needs no
 * citation) or takes a `Grounding`. A HAND-ROLLED validator is neither until
 * its author says which, and that gap is what this list holds.
 *
 * This is the whole ratchet, and one sweep is enough: `ground()` sets `bounded`
 * XOR `formatOnly`, so "bounded and ungrounded" is definitionally "neither
 * formatOnly nor grounding" — this same set, without the recursion into
 * `.leaves`.
 *
 * A hand-rolled validator in no denominator is how
 * `GPUParticles3D.visibility_aabb` came to reject a negative extent that
 * `set_visibility_aabb` assigns unaltered.
 *
 * Only ever shrinks. Classify the validator instead of adding an entry.
 */
const UNCLASSIFIED_VALIDATOR_BUDGET = 0;

/**
 * A grounding whose cite names no engine location.
 *
 * Rides the shared walk rather than recursing itself: a private copy of that
 * recursion drifted from `unclassifiedKeys`' within hours of being written, one
 * carrying a cycle-safety `Set` and the other not. Reaching leaves matters here
 * because a wildcard dispatcher's own tag vouches for nothing behind it, and 93
 * of the 237 leaf validators carry a grounding of their own.
 */
const citesNoEngineLocation = (validator: PropertyValidator): boolean =>
  validator.grounding !== undefined && !ENGINE_CITE_RE.test(validator.grounding.cite);

describe('bound grounding', () => {
  it('states an out-of-range severity wherever it states a range', () => {
    // The two travel together into one sheet row, so a range beside an empty
    // `Out of range` cell tells a reader the bound has no consequence. This
    // sweep is the one `tiers` shipped without: 55 validators built from an
    // inline arrow went untagged, three of them with an enforced floor and a
    // hinted ceiling, and nothing said so.
    expect(rangeWithoutTiers()).toEqual([]);
  });

  it('classifies every validator as format-only or grounded', () => {
    // The floor first: 1986 keys resolve to a validator today, and a budget of
    // zero is satisfied just as well by a registry that never loaded. Covers
    // hand-rolled validators too: one that never goes through the DSL declares
    // neither tag, so it lands here however many real values it rejects.
    expect(classifiableKeys().length).toBeGreaterThan(1500);
    expect(unclassifiedKeys()).toHaveLength(UNCLASSIFIED_VALIDATOR_BUDGET);
  });

  it('holds no UNGROUNDABLE entry that exempts nothing', () => {
    // The budget above reads zero whether the named validator is still there or
    // not, so without this the exemption outlives its subject and pre-forgives
    // whatever is registered under that label next.
    expect(staleUngroundable()).toEqual([]);
  });

  it('gives every grounded bound a source citation', () => {
    // The citation is the whole point: `enforced` without a `file:line` is the
    // unverifiable claim an invented threshold makes.
    expect(classifiableKeys().length).toBeGreaterThan(1500);
    expect(sweepValidators(citesNoEngineLocation)).toEqual([]);
  });
});

describe('the classification guard bites', () => {
  /** The predicate the registry sweep applies, on a single validator. */
  // The SHARED predicate, not a local copy of it: a private restatement is
  // how this guard came to prove only the half that still worked, asserting a
  // rule the registry sweep had already stopped applying.
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
    // `v.float('width')` rejects only what is not a number, so there is no bound
    // to cite. Counting it as un-audited was what inflated the ratchet to 596.
    // An INT slot is different: it rejects a non-finite, which the parser reads
    // perfectly well and the WRITE then converts (variant.h:369-370), so it
    // owes a citation like any other bound.
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
      sweepValidators(citesNoEngineLocation, [
        { label: 'Generic6DOFJoint3D.linear_limit_x/*', validator: dispatcher },
      ])
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
      sweepValidators(citesNoEngineLocation, [{ label: 'Type.key/*', validator: outer }])
    ).toEqual(['Type.key/*[0]']);
  });

  it('names an UNGROUNDABLE label that resolves to nothing, or to a grounded bound', () => {
    // Both ways an entry dies: its type or key goes away, and its validator
    // gains the citation that was missing. The grounded control is the removal
    // this file already pins a cite for below.
    expect(
      staleUngroundable(
        new Set(['NoSuchType.no_such_key', 'HBoxContainer.vertical', 'AreaLight3D.area_range'])
      )
    ).toEqual(['HBoxContainer.vertical', 'NoSuchType.no_such_key']);
  });

  it('puts removal-only types in the swept key list, not just in the registry', () => {
    // Every one of the four types declaring a removal registers NO validator of
    // its own, so none appears in `getRegisteredNodeTypes()`. Sweeping removals
    // as a nested loop inside that list visited zero of them while the count
    // still read 0. This asserts the key list itself, which is what the
    // classification test consumes.
    const swept = classifiableKeys().map(({ nodeType, key }) => `${nodeType}.${key}`);
    expect(validatorRegistry.getRegisteredNodeTypes()).not.toContain('HBoxContainer');
    expect(swept).toContain('HBoxContainer.vertical');
    expect(swept).toContain('VSplitContainer.vertical');
  });

  it('states the numbers wherever it states a tier', () => {
    // `ground()` sets `tiers` and `bounds` together, so a validator carrying one
    // without the other cannot have come from the DSL: it is hand-rolled, or it
    // went through a wrapper that forwarded only half.
    //
    // The pair is not decoration. `tiers` decides the SEVERITY of a bound and
    // `bounds` carries the NUMBERS that `hintImplementationParity` compares
    // against Godot's own hint — so a validator with only the first enforces a
    // range that no guard can check against the engine, and silently counts as
    // an unimplemented end while being fully implemented.
    expect(sweepValidators((val) => val.tiers !== undefined && val.bounds === undefined)).toEqual(
      []
    );
  });

  it('reaches removals, which getOwnKeys deliberately omits', () => {
    // HBoxContainer takes `vertical` away from BoxContainer. That refuses every
    // value of a key a scene can carry, so it needs the same citation a bound
    // does, and a sweep over declarations alone would never look at it.
    const validator = validatorRegistry.findValidator('HBoxContainer', 'vertical');
    expect(validatorRegistry.getOwnKeys('HBoxContainer')).not.toContain('vertical');
    expect(Object.keys(validatorRegistry.getOwnRemovals('HBoxContainer'))).toContain('vertical');
    expect(validator?.grounding).toEqual({ kind: 'enforced', cite: 'box_container.cpp:312' });
    expect(unclassified(validator!)).toBe(false);
  });
});
