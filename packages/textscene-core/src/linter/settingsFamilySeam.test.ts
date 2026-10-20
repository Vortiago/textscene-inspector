/**
 * The `settings/` seam, a contract between slices: `ChainIK3D` and
 * `BoneConstraint3D` each build `settings/<i>/<leaf>` with their descendants in
 * an unprefixed `get_property_list`, not `ADD_PROPERTY`. The nearest hop wins in
 * `findValidator`, so a subclass's wildcard keeps the base's bounds only by forwarding.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import type { ParseError } from './types.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { boneConstraintBaseLeaves } from '../nodes/3d/skeleton/boneconstraint3d/linterParser.js';
// The whole barrel: a per-slice test loads only its own graph, where nothing
// shadows anything and a missing forward passes.
import './index.js';
import { registeredTypes } from './registryPopulation.js';

interface Seam {
  /** The class that owns the leaves under test. */
  base: string;
  /**
   * The leaves the base's `_get_property_list` writes under `settings/<i>/`, read from the base's
   * own table where a production export carries it, so a leaf added there joins the sweep.
   */
  leaves: readonly string[];
  /** Leaves the base matches by regex rather than from the table above. */
  extraKeys?: readonly string[];
  /** One leaf with a real bound, as the anchor described below. */
  key: string;
  /** A value that leaf's bound rejects, and the severity it must report. */
  rejected: [value: string, severity: 'error' | 'warning'];
  /** A value that leaf's bound accepts. */
  accepted: string;
  /**
   * Fewest descendants that must shadow the key rather than resolve to the
   * base's own dispatcher. A plain count clears even when no subclass shadows,
   * and every row then compares the base validator with itself.
   */
  minShadowingDescendants: number;
}

const SEAMS: readonly Seam[] = [
  {
    base: 'ChainIK3D',
    // chain_ik_3d.cpp:126-133.
    leaves: [
      'root_bone_name',
      'root_bone',
      'end_bone_name',
      'end_bone',
      'extend_end_bone',
      'end_bone/direction',
      'end_bone/length',
      'joint_count',
    ],
    // Matched by JOINT_BONE_RE (chain_ik_3d.cpp:62-63), not from the table.
    extraKeys: ['settings/0/joints/0/bone', 'settings/0/joints/0/bone_name'],
    // root_bone is clamped to -1 (chain_ik_3d.cpp:186-188), so -2 is an error.
    key: 'settings/0/root_bone',
    rejected: ['-2', 'error'],
    accepted: '3',
    minShadowingDescendants: 5,
  },
  {
    base: 'BoneConstraint3D',
    leaves: Object.keys(boneConstraintBaseLeaves()),
    // amount is hinted 0..1 (bone_constraint_3d.cpp:102) with a bare-assign
    // setter, so 5 is a warning rather than an error.
    key: 'settings/0/amount',
    rejected: ['5', 'warning'],
    accepted: '0.5',
    minShadowingDescendants: 3,
  },
];

/**
 * Values spanning every shape these leaves take (int, bone name, NodePath,
 * float, bool, enum edge, garbage), so a descendant that widened any leaf
 * differs from its base on at least one of them.
 */
const PROBES: readonly string[] = [
  'definitely-not-a-valid-value',
  '-2',
  '-1',
  '7',
  '99999',
  '0.5',
  'true',
  '"Bone"',
  'NodePath("../Target")',
];

/** A diagnostic reduced to what must match across the hop. */
function summarise(error: ParseError | null): unknown {
  return error && { code: error.code, severity: error.severity, message: error.message };
}

describe.each(SEAMS)('$base settings/ seam under the full barrel', (seam) => {
  const descendants = registeredTypes('declaring')
    .filter((type) => type !== seam.base && descendsFromClass(type, seam.base))
    .sort();

  it('finds descendants that SHADOW the key, so the assertions cannot pass vacuously', () => {
    // Resolution hands back the registered function itself, so a descendant
    // that shadows nothing returns the base's own, and its rows compare the
    // base with itself.
    const baseValidator = validatorRegistry.findValidator(seam.base, seam.key);
    expect(baseValidator).not.toBeNull();
    expect(validatorRegistry.findValidator(seam.base, seam.key)).toBe(baseValidator);

    const shadowing = descendants.filter(
      (type) => validatorRegistry.findValidator(type, seam.key) !== baseValidator
    );
    expect(
      shadowing.length,
      `of ${descendants.join(', ')}, only ${shadowing.join(', ') || 'none'} shadow ${seam.key}`
    ).toBeGreaterThanOrEqual(seam.minShadowingDescendants);
  });

  const sweptKeys = [...seam.leaves.map((leaf) => `settings/0/${leaf}`), ...(seam.extraKeys ?? [])];

  it('sweeps every leaf the base declares, not one canary', () => {
    expect(sweptKeys.length).toBeGreaterThanOrEqual(seam.leaves.length);
    expect(sweptKeys).toContain(seam.key);
  });

  describe.each(descendants)('%s', (type) => {
    it(`resolves ${seam.key}, which only ${seam.base} declares`, () => {
      expect(validatorRegistry.findValidator(type, seam.key)).not.toBeNull();
    });

    it.each(sweptKeys)('answers %s exactly as the base does', (key) => {
      // Every leaf, not just the anchor below. The subclass's dispatcher wraps
      // the base's leaf, so identity proves nothing and the diagnostic's
      // equivalence is the contract. A delegation deleted for one leaf shows here.
      const sub = validatorRegistry.findValidator(type, key);
      const base = validatorRegistry.findValidator(seam.base, key);
      expect(sub, `${type} does not resolve ${key}`).not.toBeNull();
      expect(base, `${seam.base} does not resolve its own ${key}`).not.toBeNull();
      for (const value of PROBES) {
        expect(summarise(sub!(key, value, 1)), `${key} = ${value}`).toEqual(summarise(base!(key, value, 1)));
      }
    });

    it("still ENFORCES the base's bound after the hop", () => {
      // The absolute anchor the equivalence sweep needs: two vacuous dispatchers
      // agree with each other. A real bound still fires on at least one leaf.
      const validator = validatorRegistry.findValidator(type, seam.key);
      const [value, severity] = seam.rejected;
      expect(validator!(seam.key, value, 1)).toBeAtTier(severity);
    });

    it('accepts a legal value on the same leaf', () => {
      const validator = validatorRegistry.findValidator(type, seam.key);
      expect(validator!(seam.key, seam.accepted, 1)).toBeNull();
    });
  });
});
