/**
 * The `settings/` seam: a contract BETWEEN slices that no per-slice test sees.
 *
 * Two Godot families build one `settings/<i>/<leaf>` property family
 * cooperatively, each class appending leaves to the prefix its base already
 * uses: `ChainIK3D` -> `IterateIK3D` -> the IK solvers, and `BoneConstraint3D`
 * -> `AimModifier3D` / `CopyTransformModifier3D`. None of it appears in an
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
import { baseChain } from './nodeBaseTypes.js';
import './index.js';

interface Seam {
  /** The class that owns the leaf under test. */
  base: string;
  /** A leaf the base declares and no subclass re-declares. */
  key: string;
  /** A value the base's bound rejects, and the severity it must report. */
  rejected: [value: string, severity: 'error' | 'warning'];
  /** A value the base's bound accepts. */
  accepted: string;
  /** Fewest descendants expected, so a restructure cannot make this vacuous. */
  minDescendants: number;
}

const SEAMS: readonly Seam[] = [
  {
    // root_bone is clamped to -1 (chain_ik_3d.cpp:186-188), so -2 is an error.
    base: 'ChainIK3D',
    key: 'settings/0/root_bone',
    rejected: ['-2', 'error'],
    accepted: '3',
    minDescendants: 3,
  },
  {
    // amount is hinted 0..1 (bone_constraint_3d.cpp:102) with a bare-assign
    // setter, so 5 is a warning rather than an error.
    base: 'BoneConstraint3D',
    key: 'settings/0/amount',
    rejected: ['5', 'warning'],
    accepted: '0.5',
    minDescendants: 2,
  },
];

describe.each(SEAMS)('$base settings/ seam under the full barrel', (seam) => {
  const descendants = validatorRegistry
    .getRegisteredNodeTypes()
    .filter((type) => type !== seam.base && baseChain(type).includes(seam.base))
    .sort();

  it('finds descendants to check, so the assertions cannot pass vacuously', () => {
    expect(descendants.length).toBeGreaterThanOrEqual(seam.minDescendants);
  });

  describe.each(descendants)('%s', (type) => {
    it(`resolves ${seam.key}, which only ${seam.base} declares`, () => {
      expect(validatorRegistry.findValidator(type, seam.key)).not.toBeNull();
    });

    it("still ENFORCES the base's bound after the hop", () => {
      // Resolving proves the key routes somewhere; it does not prove the bound
      // survived. A dispatcher that recognised the leaf but accepted anything
      // would pass the check above and fail here, which is exactly the
      // wave's original AimModifier3D shape.
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
