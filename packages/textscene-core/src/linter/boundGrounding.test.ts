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
 * How many bounded validators still carry no grounding.
 *
 * Lower this every time a family is audited. It must never rise: adding a bound
 * without `enforced:` or `hinted:` is what this exists to catch.
 *
 * It read 476 when only `float`, `int`, `enumInt` and `strictInt` could be
 * grounded. Extending the other eight combinators (`radians`, `positiveInt`,
 * `positiveFloat`, `nonNegativeFloat`, `boundedVector3`, `strictNonNegativeInt`,
 * `layerBitmask`) did not add bounds - it let this sweep SEE bounds it had been
 * blind to, so the true total is 596. The number went up because the
 * measurement got honest, which is the only reason it may ever go up.
 */
const UNAUDITED_BOUND_BUDGET = 0;

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

interface BoundedKey {
  nodeType: string;
  key: string;
  grounded: boolean;
}

/** Every bounded validator in the registry, with whether it is grounded. */
function boundedKeys(): BoundedKey[] {
  const out: BoundedKey[] = [];
  for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
    for (const key of validatorRegistry.getOwnKeys(nodeType)) {
      const validator = validatorRegistry.findValidator(nodeType, key);
      if (!validator?.bounded) continue;
      out.push({ nodeType, key, grounded: validator.grounding !== undefined });
    }
  }
  return out;
}

describe('bound grounding', () => {
  it('grounds every bound except the one that cannot be', () => {
    const unaudited = boundedKeys()
      .filter((b) => !b.grounded)
      .map((b) => `${b.nodeType}.${b.key}`)
      .filter((name) => !UNGROUNDABLE.has(name));
    expect(unaudited.sort()).toHaveLength(UNAUDITED_BOUND_BUDGET);
  });

  it('gives every grounded bound a source citation', () => {
    // The citation is the whole point: `enforced` without a `file:line` is the
    // same unverifiable claim the invented thresholds used to make.
    const uncited: string[] = [];
    for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
      for (const key of validatorRegistry.getOwnKeys(nodeType)) {
        const g = validatorRegistry.findValidator(nodeType, key)?.grounding;
        if (g && !/\.(cpp|h):\d+/.test(g.cite)) uncited.push(`${nodeType}.${key}: "${g.cite}"`);
      }
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
