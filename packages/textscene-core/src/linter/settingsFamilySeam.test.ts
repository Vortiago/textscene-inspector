/**
 * The `settings/` seam: a contract BETWEEN slices that no per-slice test sees.
 *
 * Two Godot families build one `settings/<i>/<leaf>` property family
 * cooperatively, each class appending leaves to the prefix its base already
 * uses: `ChainIK3D` -> `IterateIK3D` -> the IK solvers, and `BoneConstraint3D`
 * -> `AimModifier3D` / `ConvertTransformModifier3D` /
 * `CopyTransformModifier3D`. None of it appears in an
 * `ADD_PROPERTY`; it is hand-rolled in `get_property_list` (unprefixed on both
 * bases, which is why a `_get_property_list` grep misses them entirely).
 *
 * `findValidator` walks the base chain and the NEAREST hop wins, with NO
 * fall-through. So every subclass that registers its own `settings/` wildcard
 * SHADOWS its base's, and the base's bounds survive only because each
 * subclass's dispatcher forwards an unrecognised leaf upward via
 * `findValidator('<Base>', key)`.
 *
 * That forwarding is a hand-written line standing in for an inheritance the
 * registry does not provide, and every per-slice test passes with it removed: a
 * scoped test loads only its own module graph, so nothing shadows anything.
 * This file loads the WHOLE barrel on purpose, and asserts the BOUND survives
 * the hop rather than merely that some validator answers.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import type { ParseError } from './types.js';
import { baseChain } from '../godot/nodeBaseTypes.js';
import { CHAIN_IK_SETTING_LEAVES } from '../nodes/3d/skeleton/chainik3d/linterParser.js';
import { BONE_CONSTRAINT_SETTING_LEAVES } from '../nodes/3d/skeleton/boneconstraint3d/linterParser.js';
import './index.js';

interface Seam {
  /** The class that owns the leaves under test. */
  base: string;
  /**
   * The base's OWN leaf table, imported rather than re-spelled, so a leaf added
   * to the base joins the sweep instead of quietly leaving it behind. A canary
   * of one leaf covered 1 of the 8 ChainIK3D declares; this covers all of them.
   */
  leaves: Readonly<Record<string, unknown>>;
  /** Leaves the base matches by regex rather than from the table above. */
  extraKeys?: readonly string[];
  /** One leaf with a real bound, as the anchor described below. */
  key: string;
  /** A value that leaf's bound rejects, and the severity it must report. */
  rejected: [value: string, severity: 'error' | 'warning'];
  /** A value that leaf's bound accepts. */
  accepted: string;
  /**
   * Fewest descendants that must SHADOW the key rather than resolve to the
   * base's own dispatcher. A plain descendant count clears just as happily when
   * every subclass has stopped shadowing, and every row below then compares the
   * base validator with itself.
   */
  minShadowingDescendants: number;
}

const SEAMS: readonly Seam[] = [
  {
    base: 'ChainIK3D',
    leaves: CHAIN_IK_SETTING_LEAVES,
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
    leaves: BONE_CONSTRAINT_SETTING_LEAVES,
    // amount is hinted 0..1 (bone_constraint_3d.cpp:102) with a bare-assign
    // setter, so 5 is a warning rather than an error.
    key: 'settings/0/amount',
    rejected: ['5', 'warning'],
    accepted: '0.5',
    minShadowingDescendants: 3,
  },
];

/**
 * Values spanning every shape these leaves take — int, bone name, NodePath,
 * float, bool, enum edge, garbage — so a descendant that widened ANY leaf
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
  const descendants = validatorRegistry
    .getRegisteredNodeTypes()
    .filter((type) => type !== seam.base && baseChain(type).includes(seam.base))
    .sort();

  it('finds descendants that SHADOW the key, so the assertions cannot pass vacuously', () => {
    // Resolution hands back the registered function itself, so a descendant
    // that shadows nothing returns the base's own and its rows below compare
    // the base with itself while a descendant COUNT still clears the floor.
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

  const sweptKeys = [
    ...Object.keys(seam.leaves).map((leaf) => `settings/0/${leaf}`),
    ...(seam.extraKeys ?? []),
  ];

  it('sweeps every leaf the base declares, not one canary', () => {
    expect(sweptKeys.length).toBeGreaterThanOrEqual(Object.keys(seam.leaves).length);
    expect(sweptKeys).toContain(seam.key);
  });

  describe.each(descendants)('%s', (type) => {
    it(`resolves ${seam.key}, which only ${seam.base} declares`, () => {
      expect(validatorRegistry.findValidator(type, seam.key)).not.toBeNull();
    });

    it.each(sweptKeys)("answers %s exactly as the base does", (key) => {
      // Every leaf, not just the anchor below. The subclass's dispatcher is a
      // DIFFERENT function from the base's leaf — it wraps it — so identity
      // proves nothing and equivalence of the diagnostic is the real contract.
      // A delegation deleted for one leaf shows up here even when the anchor
      // still passes, which is the 1-of-8 hole this replaces.
      const sub = validatorRegistry.findValidator(type, key);
      const base = validatorRegistry.findValidator(seam.base, key);
      expect(sub, `${type} does not resolve ${key}`).not.toBeNull();
      expect(base, `${seam.base} does not resolve its own ${key}`).not.toBeNull();
      for (const value of PROBES) {
        expect(summarise(sub!(key, value, 1)), `${key} = ${value}`).toEqual(
          summarise(base!(key, value, 1))
        );
      }
    });

    it("still ENFORCES the base's bound after the hop", () => {
      // The ABSOLUTE anchor the equivalence sweep needs: two dispatchers that
      // both went vacuous would agree with each other and pass it. This says a
      // real bound still fires, in its own right, on at least one leaf.
      const validator = validatorRegistry.findValidator(type, seam.key);
      const [value, severity] = seam.rejected;
      expect(validator!(seam.key, value, 1)?.severity).toBe(severity);
    });

    it('accepts a legal value on the same leaf', () => {
      const validator = validatorRegistry.findValidator(type, seam.key);
      expect(validator!(seam.key, seam.accepted, 1)).toBeNull();
    });
  });
});
