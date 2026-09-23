/**
 * The ChainIK3D set must reach its subclasses, so assert through `findValidator` on a real leaf, not
 * only the abstract key: a tier that is never imported registers nothing. Only this file's module
 * graph loads, so nothing shadows ChainIK3D here. Under the barrel, IterateIK3D's nearer `settings/`
 * wildcard delegates foreign leaves back to `findValidator('ChainIK3D', key)`, its contract to keep.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/**
 * Every key ChainIK3D registers. It has no `ADD_PROPERTY`: `_set` (chain_ik_3d.cpp:33), `_get` (:69)
 * and the unprefixed `get_property_list` (:115) build the `settings/<i>/` family. One plain
 * `settings/*` wildcard carries it, since leaves are two and three segments deep (`end_bone/length`,
 * `joints/<j>/bone`) and the glued-index `settings/#/*` reaches only one.
 */
const KEYS: string[] = ['settings/*'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;
const LEAVES = [
  'IterateIK3D',
  'SplineIK3D',
  'CCDIK3D',
  'FABRIK3D',
  'JacobianIK3D',
] as const;

/** One concrete key per leaf of the family, as a real scene spells it. */
const FAMILY_KEYS = [
  'settings/0/root_bone_name',
  'settings/0/root_bone',
  'settings/0/end_bone_name',
  'settings/0/end_bone',
  'settings/0/extend_end_bone',
  'settings/0/end_bone/direction',
  'settings/0/end_bone/length',
  'settings/0/joint_count',
  'settings/0/joints/0/bone_name',
  'settings/0/joints/0/bone',
] as const;

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string, nodeType = 'ChainIK3D') {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator registered for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ChainIK3D shared validators', () => {
  it('registers exactly what ChainIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ChainIK3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every settings leaf to %s through the base-walk', (nodeType) => {
    const missing = FAMILY_KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('exposes its leaves so the grounding sweep recurses past the dispatcher', () => {
    const dispatcher = validatorRegistry.declarationFor('ChainIK3D', 'settings/0/joint_count');
    expect(dispatcher?.leaves?.length).toBeGreaterThan(0);
    expect(dispatcher?.grounding).toEqual({ kind: 'enforced', cite: 'chain_ik_3d.cpp:39' });
  });
});

describe('ChainIK3D settings index', () => {
  it('rejects a negative setting index', () => {
    // ERR_FAIL_INDEX_V(which, (int)settings.size(), false) at chain_ik_3d.cpp:39.
    const error = check('settings/-1/root_bone_name', '"Head"');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('-1');
  });

  it('accepts an index past the live setting count, which no per-property rule can see', () => {
    expect(check('settings/12/root_bone_name', '"Head"')).toBeNull();
  });

  it('reads a non-integer index as the setting to_int resolves it to', () => {
    // `_to_int` skips non-digits rather than stopping at them
    // (ustring.cpp:2278-2294), so chain_ik_3d.cpp:37 resolves "x" to setting 0
    // and the write lands there. The key is not refused, and the leaf bound
    // still applies to the value that lands.
    expect(check('settings/x/root_bone_name', '"Head"')).toBeNull();
    expect(check('settings/x/root_bone', '-5')?.severity).toBe('error');
  });

  it('rejects an index to_int resolves as negative, however it is spelled', () => {
    // Not "no index at all": `_to_int` flips the sign on a `-` seen while the
    // total is still 0 (ustring.cpp:2291-2292), so chain_ik_3d.cpp:37 reads
    // `a-1` as -1 and the ERR_FAIL_INDEX_V at :39 refuses it.
    const error = check('settings/a-1/root_bone_name', '"Head"');
    expect(error?.severity).toBe('error');
    expect(error?.code).toBe('INVALID_SETTINGS_INDEX');
  });

  it('reads `-0-1` as index 1, since a `0` digit leaves the total at 0', () => {
    // Both `-` flip (ustring.cpp:2291-2292), so the index is positive and the
    // write lands: only the leaf bound is left to refuse the value.
    expect(check('settings/-0-1/root_bone_name', '"Head"')).toBeNull();
    const error = check('settings/-0-1/root_bone', '-5');
    expect(error?.severity).toBe('error');
    expect(error?.code).not.toBe('INVALID_SETTINGS_INDEX');
  });

  it('says nothing about a leaf ChainIK3D does not own, which a subclass adds', () => {
    // IterateIK3D adds target_node and SplineIK3D adds path_3d under the same
    // prefix (iterate_ik_3d.cpp:117, spline_ik_3d.cpp:83), so the base cannot
    // close the leaf set.
    expect(check('settings/0/target_node', 'NodePath("../Target")')).toBeNull();
    expect(check('settings/0/path_3d', 'NodePath("../Path3D")')).toBeNull();
  });
});

describe('ChainIK3D bone name leaves', () => {
  it.each(['settings/0/root_bone_name', 'settings/0/end_bone_name'])(
    'accepts any quoted string for %s',
    (key) => {
      // PROPERTY_HINT_ENUM_SUGGESTION (chain_ik_3d.cpp:126/128) suggests the
      // skeleton's bone names without restricting the value.
      expect(check(key, '"UpperArm.L"')).toBeNull();
      expect(check(key, '""')).toBeNull();
    }
  );

  it('rejects an unquoted bone name', () => {
    expect(check('settings/0/root_bone_name', 'Head')?.severity).toBe('error');
  });
});

describe('ChainIK3D bone index leaves', () => {
  it.each(['settings/0/root_bone', 'settings/0/end_bone'])('accepts a real bone index for %s', (key) => {
    expect(check(key, '0')).toBeNull();
    expect(check(key, '31')).toBeNull();
  });

  it.each(['settings/0/root_bone', 'settings/0/end_bone'])('accepts the unset sentinel -1 for %s', (key) => {
    expect(check(key, '-1')).toBeNull();
  });

  it.each(['settings/0/root_bone', 'settings/0/end_bone'])('errors below -1 for %s', (key) => {
    // chain_ik_3d.cpp:186-188 / :223-225 force any bone <= -1 back to -1.
    expect(check(key, '-2')?.severity).toBe('error');
  });

  it('warns that a non-integer bone index is truncated', () => {
    expect(check('settings/0/root_bone', '1.5')?.severity).toBe('warning');
  });
});

describe('ChainIK3D extend_end_bone', () => {
  it('accepts a boolean', () => {
    expect(check('settings/0/extend_end_bone', 'true')).toBeNull();
    expect(check('settings/0/extend_end_bone', 'false')).toBeNull();
  });

  it('rejects a non-boolean', () => {
    expect(check('settings/0/extend_end_bone', '1')?.severity).toBe('warning');
  });
});

describe('ChainIK3D end_bone/direction', () => {
  it('accepts every BoneDirection constant', () => {
    // skeleton_modifier_3d.h:56-62, +X..-Z then FromParent.
    for (let value = 0; value <= 6; value++) {
      expect(check('settings/0/end_bone/direction', String(value))).toBeNull();
    }
  });

  it('warns past the enum, which the setter still stores', () => {
    // PROPERTY_HINT_ENUM (chain_ik_3d.cpp:131) constrains the inspector only;
    // set_end_bone_direction (:260) casts straight through.
    expect(check('settings/0/end_bone/direction', '7')?.severity).toBe('warning');
    expect(check('settings/0/end_bone/direction', '-1')?.severity).toBe('warning');
  });
});

describe('ChainIK3D end_bone/length', () => {
  it('accepts a length inside and past the hint maximum', () => {
    // Hint "0,1,0.001,or_greater,suffix:m" (chain_ik_3d.cpp:132): or_greater
    // opens the max end, so nothing above 1 is reportable.
    expect(check('settings/0/end_bone/length', '0')).toBeNull();
    expect(check('settings/0/end_bone/length', '0.35')).toBeNull();
    expect(check('settings/0/end_bone/length', '12.5')).toBeNull();
  });

  it('warns below the hint floor, which the setter still stores', () => {
    // set_end_bone_length (chain_ik_3d.cpp:281) assigns unconditionally.
    expect(check('settings/0/end_bone/length', '-0.5')?.severity).toBe('warning');
  });

  it('accepts inf, which Godot writes and reloads', () => {
    // No ERR_FAIL_COND(!is_finite(...)) in set_end_bone_length.
    expect(check('settings/0/end_bone/length', 'inf')).toBeNull();
    expect(check('settings/0/end_bone/length', 'nan')).toBeNull();
  });
});

describe('ChainIK3D joint_count', () => {
  it('accepts a non-negative count', () => {
    expect(check('settings/0/joint_count', '0')).toBeNull();
    expect(check('settings/0/joint_count', '4')).toBeNull();
  });

  it('errors on a negative count', () => {
    // ERR_FAIL_COND(p_count < 0) at chain_ik_3d.cpp:333.
    expect(check('settings/0/joint_count', '-1')?.severity).toBe('error');
  });
});

describe('ChainIK3D derived joint leaves', () => {
  it.each(['settings/0/joints/0/bone', 'settings/0/joints/2/bone_name'])(
    'errors on %s, which no _set branch accepts',
    (key) => {
      const error = check(key, '"Head"');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('read-only');
    }
  );

  it('errors whatever the joint index is spelled as', () => {
    // `_set` has no `joints` branch at all, so every one of these keys falls to
    // `return false` (chain_ik_3d.cpp:62-63) and the index text decides
    // nothing.
    const error = check('settings/0/joints/x/bone', '"Head"');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('read-only');
  });

  it('says nothing about a joint leaf a subclass adds', () => {
    // IterateIK3D's joints/<j>/rotation_axis (iterate_ik_3d.cpp:117).
    expect(check('settings/0/joints/0/rotation_axis', '2')).toBeNull();
  });
});
