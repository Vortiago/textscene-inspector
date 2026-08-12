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
  staleUngroundable,
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
 * This is the whole ratchet. An earlier version also swept a `bounded` tag for
 * validators carrying no grounding, but `ground()` sets `bounded` XOR
 * `formatOnly`, so "bounded and ungrounded" was definitionally "neither
 * formatOnly nor grounding" - the same set this catches, minus the recursion
 * into `.leaves`. The tag and the weaker sweep are gone; this one stayed.
 *
 * It found `GPUParticles3D.visibility_aabb` rejecting a negative extent that
 * `set_visibility_aabb` assigns unaltered, because a hand-rolled validator had
 * never been in any denominator.
 *
 * Only ever shrinks. Classify the validator instead of adding an entry.
 */
const UNCLASSIFIED_VALIDATOR_BUDGET = 0;

/**
 * Every grounding in `validator`'s subtree whose cite names no engine location.
 *
 * Recurses into `.leaves` for the same reason `unclassifiedKeys` does: a
 * wildcard dispatcher's own tag vouches for nothing behind it, and 93 of the 237
 * leaf validators carry a grounding of their own. Reading only the dispatcher
 * let a leaf cite prose and stay green.
 *
 * `seen` is insurance against a shared or self-referential leaf instance, not a
 * filter — a validator reached twice makes the same claim both times.
 */
function uncitedGroundings(
  validator: PropertyValidator,
  label: string,
  seen = new Set<PropertyValidator>()
): string[] {
  if (seen.has(validator)) return [];
  seen.add(validator);
  const g = validator.grounding;
  const out = g && !ENGINE_CITE_RE.test(g.cite) ? [`${label}: "${g.cite}"`] : [];
  for (const [index, leaf] of (validator.leaves ?? []).entries()) {
    out.push(...uncitedGroundings(leaf, `${label}[${index}]`, seen));
  }
  return out;
}

describe('bound grounding', () => {
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
    // same unverifiable claim the invented thresholds used to make.
    const keys = classifiableKeys();
    expect(keys.length).toBeGreaterThan(1500);
    const uncited: string[] = [];
    const seen = new Set<PropertyValidator>();
    for (const { nodeType, key } of keys) {
      const validator = validatorRegistry.findValidator(nodeType, key);
      if (validator) uncited.push(...uncitedGroundings(validator, `${nodeType}.${key}`, seen));
    }
    expect(uncited.sort()).toEqual([]);
  });
});

describe('the classification guard bites', () => {
  /** The predicate the registry sweep applies, on a single validator. */
  const unclassified = (validator: PropertyValidator) =>
    !validator.formatOnly && !validator.grounding;

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

  it('treats an unbounded numeric combinator as format-only', () => {
    // `v.float('width')` rejects only what is not a number, so there is no bound
    // to cite. Counting it as un-audited was what inflated the ratchet to 596.
    expect(v.float('width').formatOnly).toBe(true);
    expect(v.int('count').formatOnly).toBe(true);
    expect(
      v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' }).formatOnly
    ).toBeUndefined();
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

    expect(uncitedGroundings(dispatcher, 'Generic6DOFJoint3D.linear_limit_x/*')).toEqual([
      'Generic6DOFJoint3D.linear_limit_x/*[0]: "the class reference gives 0 to 1"',
    ]);
  });

  it('reports a shared leaf instance once, however many slots reach it', () => {
    // One leaf instance can back several sub-properties, so the walk must not
    // treat re-encountering it as a second defect.
    const leaf: PropertyValidator = () => null;
    leaf.grounding = { kind: 'enforced', cite: 'no file here' };
    const outer: PropertyValidator = () => null;
    outer.formatOnly = true;
    outer.leaves = [leaf, leaf];

    expect(uncitedGroundings(outer, 'Type.key/*')).toEqual(['Type.key/*[0]: "no file here"']);
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
