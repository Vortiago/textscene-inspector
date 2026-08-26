/**
 * What the two grounding tiers DO, once a bound carries one.
 *
 * ADR-0032 splits a bound by who enforces it: `enforced` means Godot's setter
 * refuses or alters the value, `hinted` means only the inspector's
 * `PROPERTY_HINT_RANGE` says so. That distinction is worth nothing unless it
 * reaches the diagnostic, and per END rather than per bound — a floor and a
 * ceiling are routinely grounded differently on the same property.
 *
 * The registry-wide sweep that requires every bound to carry one of the two is
 * the sibling `boundGrounding.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { v } from './validators/v.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { outerEndIsReachable } from './validators/v/grounding.js';
import './index.js'; // side-effect: every slice registers its validators
import { layerBitmask } from './validators/layerBitmask.js';
import type { PropertyValidator } from './ValidatorRegistry.js';

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
      layerBitmask('mask', { hinted: 'h.cpp:8', width: 'uint32' }),
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
    // `float`/`int` must split the tier per END rather than through
    // `boundSeverity`, which returns 'error'
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

  it('splits enumInt per end too, rather than collapsing both to error', () => {
    // `boundSeverity` returned 'warning' only when BOTH ends were hinted, so an
    // enforced floor made the whole bound error, ceiling included.
    const split = v.enumInt(
      'mode',
      1,
      3,
      { 1: 'A', 2: 'B', 3: 'C' },
      { enforced: { min: 'x.cpp:10' }, hinted: { max: 'x.cpp:11' } }
    );
    expect(split('mode', '0', 1)?.severity).toBe('error');
    expect(split('mode', '4', 1)?.severity).toBe('warning');
  });

  it('splits boundedVector3 per end too', () => {
    const split = v.boundedVector3('size', {
      min: 0.01,
      max: 1024,
      enforced: { min: 'gpu_particles_collision_3d.cpp:97' },
      hinted: { max: 'gpu_particles_collision_3d.cpp:101' },
    });
    expect(split('size', 'Vector3(0, 1, 1)', 1)?.severity).toBe('error');
    expect(split('size', 'Vector3(2048, 1, 1)', 1)?.severity).toBe('warning');
  });

  it('keeps BOTH citations when the ends are grounded differently', () => {
    // Recording only the enforced one discarded the hinted end's file:line, so
    // the citation sweep could never check it.
    const split = v.float('extra_cull_margin', {
      min: 0,
      max: 16384,
      enforced: { min: 'visual_instance_3d.cpp:377' },
      hinted: { max: 'visual_instance_3d.cpp:602' },
    });
    expect(split.grounding?.cite).toContain('visual_instance_3d.cpp:377');
    expect(split.grounding?.cite).toContain('visual_instance_3d.cpp:602');
  });

  it('keeps both ENFORCED citations too, not just the first', () => {
    // `Control.anchors_preset` is the live shape: a -1 early return at one line
    // and an ERR_FAIL_INDEX at another. Dropping the max cite put it outside the
    // citation sweep, so a wrong or malformed one could never fail.
    const preset = v.int('anchors_preset', {
      min: -1,
      max: 15,
      enforced: { min: 'control.cpp:983', max: 'control.cpp:1116' },
    });
    expect(preset.grounding?.cite).toContain('control.cpp:983');
    expect(preset.grounding?.cite).toContain('control.cpp:1116');
  });
});

describe('an end no value can reach reports at the setter\'s tier', () => {
  it('holds for every bounded validator in the live registry', () => {
    // The tier split is unfalsifiable from inside one combinator: `endSeverity`
    // derives its own answer, so a wrong one looks exactly like a right one.
    // This is the second file. A hint end sits behind a setter end that is at
    // or INSIDE it — no value can be outside the hint without the setter having
    // refused it first — so the band the hint's tier would describe is empty
    // and the end must report the setter's `error`.
    const wrong: string[] = [];
    let examined = 0;
    for (const type of validatorRegistry.getRegisteredNodeTypes()) {
      for (const key of validatorRegistry.getOwnKeys(type)) {
        const validator = validatorRegistry.findValidator(type, key);
        const bounds = validator?.bounds;
        if (!bounds || !validator?.tiers) continue;
        for (const end of ['min', 'max'] as const) {
          if (bounds[end] === undefined) continue;
          examined += 1;
          if (outerEndIsReachable(bounds, end)) continue;
          if (validator.tiers[end] !== 'error') {
            wrong.push(`${type}.${key} ${end} is ${validator.tiers[end]}`);
          }
        }
      }
    }
    // Anti-vacuity: the sweep is registry-derived, so a registry that stopped
    // tagging `bounds` would leave this trivially green.
    expect(examined).toBeGreaterThan(500);
    expect(wrong).toEqual([]);
  });

  it('bites: a setter end coinciding with the hint\'s leaves no band to warn in', () => {
    const coinciding = v.float('aspect_ratio', {
      min: 0,
      max: 100,
      enforcedMin: { at: 0, exclusive: true },
      enforced: { min: 'openxr_composition_layer_cylinder.cpp:60' },
      hinted: { max: 'openxr_composition_layer_cylinder.cpp:106' },
    });
    expect(coinciding.tiers?.min).toBe('error');
    // And a setter end genuinely further out still hands the band to the hint.
    const separated = v.float('extra_cull_margin', {
      min: 1,
      max: 16384,
      enforcedMin: { at: 0 },
      enforced: { min: 'visual_instance_3d.cpp:377' },
      hinted: { min: 'visual_instance_3d.cpp:602' },
    });
    expect(separated.tiers?.min).toBe('warning');
  });
});
