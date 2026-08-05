/**
 * The IKModifier3D set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 *
 * The leaves cover BOTH direct branches. CCDIK3D, FABRIK3D and JacobianIK3D
 * share one path (IterateIK3D, then ChainIK3D), so a broken TwoBoneIK3D link
 * is invisible in all three.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/**
 * Every key IKModifier3D binds, read from its ADD_PROPERTY calls.
 *
 * `ik_modifier_3d.cpp:64` is the class's only ADD_PROPERTY, and
 * `doc/classes/IKModifier3D.xml` lists the matching single member.
 * `setting_count` and the `settings/<i>/` family are NOT here: the subclasses
 * declare them, with different leaves per branch.
 */
const KEYS: string[] = ['mutable_bone_axes'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;
const LEAVES = [
  'ChainIK3D',
  'TwoBoneIK3D',
  'IterateIK3D',
  'SplineIK3D',
  'CCDIK3D',
  'FABRIK3D',
  'JacobianIK3D',
] as const;

describe('IKModifier3D shared validators', () => {
  it('registers exactly what IKModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('IKModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(LEAVES)('accepts both boolean spellings of mutable_bone_axes on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'mutable_bone_axes');
    expect(validator).not.toBeNull();
    expect(validator!('mutable_bone_axes', 'true', 1)).toBeNull();
    expect(validator!('mutable_bone_axes', 'false', 1)).toBeNull();
  });

  it('rejects a non-boolean mutable_bone_axes', () => {
    const validator = validatorRegistry.findValidator('TwoBoneIK3D', 'mutable_bone_axes');
    expect(validator!('mutable_bone_axes', '1', 1)).not.toBeNull();
    expect(validator!('mutable_bone_axes', 'garbage', 1)).not.toBeNull();
  });

  it('constrains format only, since the setter assigns straight through', () => {
    // ik_modifier_3d.cpp:156 is a bare assignment plus dirty-flagging, and the
    // ADD_PROPERTY carries no hint, so there is no value to ground a bound on.
    const validator = validatorRegistry.findValidator('TwoBoneIK3D', 'mutable_bone_axes');
    expect(validator!.formatOnly).toBe(true);
    expect(validator!.grounding).toBeUndefined();
  });
});
