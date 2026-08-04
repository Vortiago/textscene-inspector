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
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import { layerBitmask } from './validators/layerBitmask.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import './index.js'; // side-effect: every slice registers its validators

/**
 * The one bound that cannot be grounded, with the reason.
 *
 * `AreaLight3D` does not exist anywhere in Godot 4.6.3, so it has no
 * ADD_PROPERTY hint and no setter to cite. Its slice sheet records that the
 * node postdates this engine build. Guessing a citation would be worse than
 * admitting there is none, so the bound stays an ungrounded error and is named
 * here rather than hidden in a count.
 */
const UNGROUNDABLE: ReadonlySet<string> = new Set(['AreaLight3D.area_range']);

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
 * Every key that resolves to a validator, declarations AND removals.
 *
 * Removals are the third population: `getOwnKeys` deliberately omits them (a
 * removal is not a declaration), so a sweep built on it alone cannot see a
 * rejection that refuses every value of the key outright.
 */
function classifiableKeys(): { nodeType: string; key: string }[] {
  const out: { nodeType: string; key: string }[] = [];
  for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
    for (const key of validatorRegistry.getOwnKeys(nodeType)) out.push({ nodeType, key });
  }
  // A separate walk, not a nested loop: a type that ONLY removes never appears
  // in the validator map, so folding removals into the loop above visited none
  // of them.
  for (const nodeType of validatorRegistry.getTypesWithRemovals()) {
    for (const key of Object.keys(validatorRegistry.getOwnRemovals(nodeType))) {
      out.push({ nodeType, key });
    }
  }
  return out;
}

/**
 * Every registered validator that declares neither `formatOnly` nor `grounding`,
 * counting a wildcard dispatcher's leaves as separate validators.
 *
 * Without the recursion a dispatcher's own tag would vouch for every bound
 * behind it: `Generic6DOFJoint3D` registers 18 wildcard keys covering 27 leaf
 * validators, and the sweep saw 18 functions.
 */
function unclassifiedKeys(): string[] {
  const out: string[] = [];

  const visit = (validator: PropertyValidator, label: string): void => {
    // The exemption covers THIS validator, never its subtree: returning early
    // would let one exempt wildcard key excuse every leaf behind it.
    if (!UNGROUNDABLE.has(label) && !validator.formatOnly && !validator.grounding) {
      out.push(label);
    }
    validator.leaves?.forEach((leaf, index) => visit(leaf, `${label}[${index}]`));
  };

  for (const { nodeType, key } of classifiableKeys()) {
    const validator = validatorRegistry.findValidator(nodeType, key);
    if (validator) visit(validator, `${nodeType}.${key}`);
  }
  return out.sort();
}

describe('bound grounding', () => {
  it('classifies every validator as format-only or grounded', () => {
    // Covers hand-rolled validators too: one that never goes through the DSL
    // declares neither tag, so it lands here however many real values it rejects.
    expect(unclassifiedKeys()).toHaveLength(UNCLASSIFIED_VALIDATOR_BUDGET);
  });

  it('gives every grounded bound a source citation', () => {
    // The citation is the whole point: `enforced` without a `file:line` is the
    // same unverifiable claim the invented thresholds used to make.
    const uncited: string[] = [];
    for (const { nodeType, key } of classifiableKeys()) {
      const g = validatorRegistry.findValidator(nodeType, key)?.grounding;
      if (g && !/\.(cpp|h):\d+/.test(g.cite)) uncited.push(`${nodeType}.${key}: "${g.cite}"`);
    }
    expect(uncited.sort()).toEqual([]);
  });
});

describe('the two tiers behave differently', () => {
  it('an enforced bound rejects out-of-range as an error', () => {
    // Godot's own guard, so the value genuinely does not reach the engine.
    const validator = v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' });
    expect(validator('fov', '250', 1)?.severity).toBe('error');
    expect(validator.grounding).toEqual({ kind: 'enforced', cite: 'camera_3d.cpp:725' });
  });

  it('a hinted bound reports out-of-range as a warning', () => {
    // The inspector will not offer it, but a .tscn carrying it loads and runs.
    const validator = v.float('near', { min: 0.001, hinted: 'camera_3d.cpp:685' });
    expect(validator('near', '0.0001', 1)?.severity).toBe('warning');
    expect(validator.grounding).toEqual({ kind: 'hinted', cite: 'camera_3d.cpp:685' });
  });

  it('keeps a FORMAT failure an error whatever the grounding', () => {
    // An unparseable value is malformed regardless of what Godot would accept.
    const validator = v.float('near', { min: 0.001, hinted: 'camera_3d.cpp:685' });
    expect(validator('near', 'not-a-number', 1)?.severity).toBe('error');
  });

  it('applies the same split to an enum', () => {
    const hinted = v.enumInt('mode', 0, 2, { 0: 'A', 1: 'B', 2: 'C' }, { hinted: 'x.cpp:10' });
    expect(hinted('mode', '9', 1)?.severity).toBe('warning');
    const enforced = v.enumInt('mode', 0, 2, { 0: 'A', 1: 'B', 2: 'C' }, { enforced: 'x.cpp:11' });
    expect(enforced('mode', '9', 1)?.severity).toBe('error');
  });

  it('leaves an un-audited bound erroring, as it did before the split', () => {
    const validator = v.float('legacy', { min: 0 });
    expect(validator('legacy', '-1', 1)?.severity).toBe('error');
    expect(validator.grounding).toBeUndefined();
  });
});

describe('per-end grounding', () => {
  it('gives an enforced floor and a hinted ceiling different severities', () => {
    // PhysicalBone2D.bone2d_index is the real shape: ERR_FAIL_COND on the floor
    // (physical_bone_2d.cpp:229), nothing but a hint on the ceiling (:283).
    const validator = v.strictInt('bone2d_index', {
      min: 0,
      max: 1000,
      enforced: { min: 'physical_bone_2d.cpp:229' },
      hinted: { max: 'physical_bone_2d.cpp:283' },
    });
    expect(validator('bone2d_index', '-1', 1)?.severity).toBe('error');
    expect(validator('bone2d_index', '1001', 1)?.severity).toBe('warning');
  });

  it('grounds every bounded combinator, not just float and int', () => {
    // The audit found eight combinators that could not carry a citation, which
    // covered a large share of the bounds needing one.
    const cases: PropertyValidator[] = [
      v.radians('angle', { maxDeg: 180, hinted: 'a.cpp:1' }),
      v.nonNegativeFloat('n', { hinted: 'b.cpp:2' }),
      v.positiveFloat('p', undefined, { hinted: 'c.cpp:3' }),
      v.positiveInt('i', undefined, { hinted: 'd.cpp:4' }),
      v.strictNonNegativeInt('s', { hinted: 'e.cpp:5' }),
      v.boundedVector3('vec', { min: 0, hinted: 'f.cpp:6' }),
      v.strictInt('si', { min: 0, hinted: 'g.cpp:7' }),
      layerBitmask('mask', { hinted: 'h.cpp:8' }),
    ];
    for (const validator of cases) {
      expect(validator.grounding?.kind).toBe('hinted');
    }
  });

  it('reports a hinted violation as a warning through those combinators too', () => {
    expect(v.nonNegativeFloat('n', { hinted: 'b.cpp:2' })('n', '-1', 1)?.severity).toBe('warning');
    expect(v.positiveInt('i', undefined, { hinted: 'd.cpp:4' })('i', '0', 1)?.severity).toBe(
      'warning'
    );
    expect(
      v.boundedVector3('vec', { min: 0, hinted: 'f.cpp:6' })('vec', 'Vector3(-1, 0, 0)', 1)
        ?.severity
    ).toBe('warning');
  });

  it('splits float and int the same way strictInt does', () => {
    // Regression for a bug the 3D rendering audit found: `float`/`int` used to
    // collapse a per-end split through `boundSeverity`, which returns 'error'
    // unless BOTH ends are hinted — so `{ enforced: { min }, hinted: { max } }`
    // typechecked but silently made the whole bound an error. CSGCylinder3D's
    // `sides` (enforced floor csg_shape.cpp:1876, hinted ceiling :1849) is the
    // real shape this fixes.
    const floatV = v.float('extra_cull_margin', {
      min: 0,
      max: 16384,
      enforced: { min: 'visual_instance_3d.cpp:377' },
      hinted: { max: 'visual_instance_3d.cpp:602' },
    });
    expect(floatV('extra_cull_margin', '-1', 1)?.severity).toBe('error');
    expect(floatV('extra_cull_margin', '20000', 1)?.severity).toBe('warning');

    const intV = v.int('sides', {
      min: 3,
      max: 64,
      enforced: { min: 'csg_shape.cpp:1876' },
      hinted: { max: 'csg_shape.cpp:1849' },
    });
    expect(intV('sides', '2', 1)?.severity).toBe('error');
    expect(intV('sides', '65', 1)?.severity).toBe('warning');
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
    expect(v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' }).formatOnly).toBeUndefined();
  });

  it('passes a grounded bound, which cites instead of declaring format-only', () => {
    const validator = v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' });
    expect(validator.formatOnly).toBeUndefined();
    expect(unclassified(validator)).toBe(false);
  });

  it('catches a bound whose grounding was left off', () => {
    expect(unclassified(v.float('fov', { min: 1, max: 179 }))).toBe(true);
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
