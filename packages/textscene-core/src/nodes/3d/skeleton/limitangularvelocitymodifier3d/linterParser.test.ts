/**
 * LimitAngularVelocityModifier3D strict validators: format, range and the
 * degree-versus-radian question `max_angular_velocity` raises.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour would belong in linter.test.ts, through
 * `Linter`; this slice registers no rules, for the reason linterParser.ts gives.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string, nodeType = 'LimitAngularVelocityModifier3D') {
  const validator = validatorRegistry.declarationFor(nodeType, property);
  expect(validator, `no validator registered for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key LimitAngularVelocityModifier3D registers.
 *
 * Two `ADD_PROPERTY` calls (limit_angular_velocity_modifier_3d.cpp:272-273) and
 * one of the two `ADD_ARRAY_COUNT` calls (:274; :275 declares `joint_count`
 * with an empty setter, so it is getter-only and gets no validator), plus the
 * two families `_get_property_list` builds by hand (:98, :106), which appear in
 * no `ADD_*` call at all.
 */
const KEYS: string[] = [
  'max_angular_velocity',
  'exclude',
  'chain_count',
  'chains/#/*',
  'joints/#/*',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/** One concrete key per chain leaf, as a real scene spells it. */
const CHAIN_KEYS = [
  'chains/0/root_bone_name',
  'chains/0/root_bone',
  'chains/0/end_bone_name',
  'chains/0/end_bone',
] as const;

describe('LimitAngularVelocityModifier3D strict validators', () => {
  it('registers exactly what LimitAngularVelocityModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('LimitAngularVelocityModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-limit-angular-velocity-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('LimitAngularVelocityModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches every chain leaf through the glued-index wildcard', () => {
    const missing = CHAIN_KEYS.filter(
      (key) => !validatorRegistry.declarationFor('LimitAngularVelocityModifier3D', key)
    );
    expect(missing).toEqual([]);
  });

  it('exposes the chain leaves so the grounding sweep recurses past the dispatcher', () => {
    const dispatcher = validatorRegistry.declarationFor(
      'LimitAngularVelocityModifier3D',
      'chains/0/root_bone'
    );
    expect(dispatcher?.leaves?.length).toBe(4);
    expect(dispatcher?.grounding).toEqual({
      kind: 'enforced',
      cite: 'limit_angular_velocity_modifier_3d.cpp:39',
    });
  });
});

/**
 * The whole point of the slice.
 *
 * `ADD_PROPERTY(..., PROPERTY_HINT_RANGE, "0,720,or_greater,radians_as_degrees,
 * suffix:°/s")` at limit_angular_velocity_modifier_3d.cpp:272, whose suffix the
 * source concatenates from `String(U"°") + "/s"`. The hint's numbers are
 * DEGREES per second; the `.tscn` stores RADIANS per second. The
 * degree-to-radian pairs, side by side:
 *
 * |   hint (degrees/s) | stored (radians/s) | bounded here? |
 * | -----------------: | -----------------: | ------------- |
 * |                  0 |                  0 | yes, the floor, and the two units agree at it |
 * |                360 |          6.2831855 | no, it is the class default (h:53, Math::TAU) |
 * |                720 |          12.566371 | no, `or_greater` opens the max end |
 * |              45836 |                800 | no, same reason |
 */
describe('LimitAngularVelocityModifier3D max_angular_velocity', () => {
  it('accepts the default Godot itself writes', () => {
    // `double max_angular_velocity = Math::TAU` (limit_angular_velocity_modifier_3d.h:53),
    // serialised as 6.2831855: TAU radians per second, which the inspector
    // shows as 360 degrees per second.
    expect(check('max_angular_velocity', '6.2831855')).toBeNull();
  });

  it('accepts the hint ceiling converted into the unit the file stores', () => {
    // 720 degrees is 4 * PI = 12.566371 radians. Accepted, and so is the value
    // just past it, which is what proves the ceiling is OPEN rather than
    // converted-and-closed: `v.radians({ maxDeg: 720 })` would reject 12.6.
    expect(check('max_angular_velocity', '12.566371')).toBeNull();
    expect(check('max_angular_velocity', '12.6')).toBeNull();
  });

  it('accepts a value above the hint number, which is not a radian bound', () => {
    // 800 RADIANS per second is 45836 degrees per second. A validator bounded on
    // the raw hint number (`max: 720`) would accept it too, so the pair that
    // separates the two mistakes is this one and the 12.6 above; a validator
    // bounded at 720 RADIANS rejects nothing a scene can contain, which is the
    // trap `radians_as_degrees` sets.
    expect(check('max_angular_velocity', '800.0')).toBeNull();
    expect(check('max_angular_velocity', '20.0')).toBeNull();
  });

  it('carries the radian epsilon on the floor, which 0 degrees round-trips under', () => {
    // 0 degrees is 0 radians, so the conversion is the identity here, but the
    // tolerance is not. Godot stores this as a double fed from a float32
    // inspector spinner and writes it back in decimal, so a value set to 0
    // reloads a hair negative, and a floor at exactly 0 rejects it.
    expect(check('max_angular_velocity', '-0.00005')).toBeNull();
  });

  it('warns below the floor, which the two units share', () => {
    // The hint states the floor and set_max_angular_velocity (:231-233) assigns
    // straight through with no clamp, so ADR-0032 makes it a warning.
    expect(check('max_angular_velocity', '0')).toBeNull();
    expect(check('max_angular_velocity', '0.0')).toBeNull();
    const below = check('max_angular_velocity', '-0.01');
    expect(below?.severity).toBe('warning');
    expect(below?.message).toContain('max_angular_velocity');
  });

  it('keeps inf and nan, which no is_finite guard refuses', () => {
    // `inf` / `nan` are legal float literals Godot writes and reloads, and
    // set_max_angular_velocity opens with no ERR_FAIL_COND(!is_finite(...)).
    expect(check('max_angular_velocity', 'inf')).toBeNull();
    expect(check('max_angular_velocity', 'nan')).toBeNull();
    // `-inf` is below the hinted floor for the same reason -0.01 is, so it
    // draws the same warning rather than a finiteness error.
    expect(check('max_angular_velocity', '-inf')?.severity).toBe('warning');
  });

  it('rejects a value that is not a number at all', () => {
    expect(check('max_angular_velocity', '"fast"')?.severity).toBe('error');
  });
});

describe('LimitAngularVelocityModifier3D exclude', () => {
  it('accepts both boolean literals', () => {
    // limit_angular_velocity_modifier_3d.cpp:273, Variant::BOOL, no hint;
    // set_exclude (:239-241) assigns whatever it is given.
    expect(check('exclude', 'true')).toBeNull();
    expect(check('exclude', 'false')).toBeNull();
  });

  it('rejects anything else', () => {
    expect(check('exclude', '1')).not.toBeNull();
    expect(check('exclude', 'True')).not.toBeNull();
  });
});

describe('LimitAngularVelocityModifier3D chain_count', () => {
  it('accepts zero and any positive count', () => {
    // `chains.resize(p_count)` (:205) has no ceiling of its own, and the live
    // upper bound is memory rather than a constant.
    expect(check('chain_count', '0')).toBeNull();
    expect(check('chain_count', '4')).toBeNull();
    expect(check('chain_count', '4096')).toBeNull();
  });

  it('errors below zero, which the setter refuses outright', () => {
    // ERR_FAIL_COND(p_count < 0) at limit_angular_velocity_modifier_3d.cpp:204,
    // so the resize never happens: enforced, not hinted.
    expect(check('chain_count', '-1')?.severity).toBe('error');
  });

  it('warns that a fractional count is truncated', () => {
    expect(check('chain_count', '2.5')?.severity).toBe('warning');
  });
});

describe('LimitAngularVelocityModifier3D chains family', () => {
  it.each(['chains/0/root_bone_name', 'chains/0/end_bone_name'])(
    'accepts any quoted string for %s',
    (key) => {
      // PROPERTY_HINT_ENUM_SUGGESTION over the skeleton's bone names
      // (limit_angular_velocity_modifier_3d.cpp:99/101) suggests without
      // restricting, and the setters (:129, :166) store the String as given.
      expect(check(key, '"UpperArm.L"')).toBeNull();
      expect(check(key, '""')).toBeNull();
      expect(check(key, 'UpperArm.L')?.severity).toBe('error');
    }
  );

  it.each(['chains/0/root_bone', 'chains/0/end_bone'])(
    'accepts the -1 sentinel and any real index for %s',
    (key) => {
      expect(check(key, '-1')).toBeNull();
      expect(check(key, '0')).toBeNull();
      // The upper bound is the live bone count, which no per-property
      // validator can see.
      expect(check(key, '250')).toBeNull();
    }
  );

  it.each(['chains/0/root_bone', 'chains/0/end_bone'])(
    'errors below the -1 sentinel for %s, which the setter rewrites',
    (key) => {
      // set_root_bone (:149-151) and set_end_bone (:186-188) both rewrite
      // anything at or below -1 to -1, and _validate_bone_names (:293-295,
      // :299-300) re-runs them on the first skeleton update, so a value under
      // -1 cannot survive as written.
      expect(check(key, '-2')?.severity).toBe('error');
    }
  );

  it.each(['chains/0/root_bone', 'chains/0/end_bone'])(
    'warns that a fractional bone index is truncated for %s',
    (key) => {
      expect(check(key, '1.5')?.severity).toBe('warning');
    }
  );

  it('rejects a negative chain index', () => {
    // ERR_FAIL_INDEX_V(which, (int)chains.size(), false) at
    // limit_angular_velocity_modifier_3d.cpp:39.
    const error = check('chains/-1/root_bone_name', '"Head"');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('-1');
  });

  it('accepts an index past the live chain count, which no per-property rule can see', () => {
    expect(check('chains/12/root_bone_name', '"Head"')).toBeNull();
  });

  it('says nothing about a non-integer index, which Godot reads as a chain anyway', () => {
    // `_set` reads it with a bare `get_slicec('/', 1).to_int()` (:37), and
    // `to_int` skips non-digits rather than stopping at them, so `chains/x/...`
    // resolves to chain 0 and the write lands. Nothing refuses it, so ADR-0032
    // grounds no diagnostic on the index; the LEAF still decides, which is the
    // shared `indexedFamilyValidator`'s documented `to_int` behaviour.
    //
    // ChainIK3D reads the other way on the same construct
    // (`check('settings/x/root_bone', '-5')` is null there) because it predates
    // the helper and hand-rolls a dispatcher that returns before the leaf. The
    // divergence is that dispatcher's, not a disagreement about the engine.
    expect(check('chains/x/root_bone_name', '"Head"')).toBeNull();
    expect(check('chains/x/root_bone', '-5')?.severity).toBe('error');
  });

  it('rejects a leaf the class does not declare, its set being closed', () => {
    // Nothing in the engine derives from LimitAngularVelocityModifier3D
    // (register_scene_types.cpp:687 registers it as a concrete class), and
    // `_set` returns false for any other `what` (:49-50), so the write is
    // dropped rather than handed to a subclass.
    expect(check('chains/0/target_node', 'NodePath("../Target")')?.severity).toBe('error');
  });
});

describe('LimitAngularVelocityModifier3D joints family', () => {
  it.each(['joints/0/bone', 'joints/0/bone_name', 'joints/3/anything'])(
    'reports %s as read-only, since the write is discarded',
    (key) => {
      // Neither PropertyInfo carries STORAGE (:107 is EDITOR | READ_ONLY, :108
      // is a bare READ_ONLY), so Godot never writes these; and `_set` has no
      // `joints/` branch, so a hand-written one falls through to `return true`
      // (:53) having assigned nothing.
      const error = check(key, '2');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('read-only');
    }
  );

  it('grounds the verdict on the fall-through in _set', () => {
    const validator = validatorRegistry.declarationFor(
      'LimitAngularVelocityModifier3D',
      'joints/0/bone'
    );
    expect(validator?.grounding).toEqual({
      kind: 'enforced',
      cite: 'limit_angular_velocity_modifier_3d.cpp:36-53',
    });
  });
});

describe('LimitAngularVelocityModifier3D inherited keys', () => {
  it.each(['active', 'influence'])(
    'resolves %s through the base-walk without re-declaring it',
    (key) => {
      expect(validatorRegistry.findValidator('LimitAngularVelocityModifier3D', key)).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('LimitAngularVelocityModifier3D')).not.toContain(key);
      // The SAME function object, so the slice cannot have shadowed it with a
      // copy that then drifts from SkeletonModifier3D's.
      expect(validatorRegistry.findValidator('LimitAngularVelocityModifier3D', key)).toBe(
        validatorRegistry.findValidator('SkeletonModifier3D', key)
      );
    }
  );

  it('applies SkeletonModifier3D influence bound here', () => {
    // skeleton_modifier_3d.cpp:161 hints influence to "0,1,0.001", so 1.5 is
    // out of range on a LimitAngularVelocityModifier3D too.
    expect(check('influence', '0.5')).toBeNull();
    expect(check('influence', '1.5')?.severity).toBe('warning');
  });

  it('does not declare joint_count, whose ADD_ARRAY_COUNT has an empty setter', () => {
    // limit_angular_velocity_modifier_3d.cpp:275. `add_property` resolves a
    // setter MethodBind only when one is named (class_db.cpp:1512), so there is
    // no value of the key Godot would ever read back and refuse.
    expect(validatorRegistry.getOwnKeys('LimitAngularVelocityModifier3D')).not.toContain(
      'joint_count'
    );
  });
});
