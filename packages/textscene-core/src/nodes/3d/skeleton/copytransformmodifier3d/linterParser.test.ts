/**
 * CopyTransformModifier3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it.
 *
 * Every bound quotes the Godot 4.6.3 line that states it, matching the
 * citations in `linterParser.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CopyTransformModifier3D', property);
  expect(validator, `no validator registered for CopyTransformModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys CopyTransformModifier3D declares: `setting_count` from
 * `ADD_ARRAY_COUNT` (copy_transform_modifier_3d.cpp:358) and the
 * `settings/<i>/<leaf>` family its `_get_property_list` materialises
 * (copy_transform_modifier_3d.cpp:83-101). `getOwnKeys` returns registered
 * PATTERNS, so the family counts once, as `settings/#/*`.
 */
const KEYS: string[] = ['setting_count', 'settings/#/*'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/** The three flag leaves, each hinted PROPERTY_HINT_FLAGS with three bits. */
const FLAG_LEAVES = ['copy', 'axes', 'invert'] as const;

describe('CopyTransformModifier3D strict validators', () => {
  it('registers exactly what CopyTransformModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CopyTransformModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-copy-transform-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('CopyTransformModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('setting_count', () => {
    it('accepts zero and a populated count', () => {
      expect(check('setting_count', '0')).toBeNull();
      expect(check('setting_count', '2')).toBeNull();
    });

    it('rejects a negative count as an error, which the setter refuses', () => {
      // bone_constraint_3d.cpp:131, `ERR_FAIL_COND(p_count < 0)`.
      const error = check('setting_count', '-1');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('setting_count');
    });

    it('has no ceiling, so a large count passes', () => {
      expect(check('setting_count', '4096')).toBeNull();
    });
  });

  describe('settings/<i>/copy, axes and invert', () => {
    it('accepts every subset of the three hinted bits', () => {
      for (const leaf of FLAG_LEAVES) {
        for (const bits of [0, 1, 2, 3, 4, 5, 6, 7]) {
          expect(check(`settings/0/${leaf}`, String(bits)), `${leaf} = ${bits}`).toBeNull();
        }
      }
    });

    it('warns rather than errors on a bit the flag list does not offer', () => {
      // The setters are bare assignments (copy_transform_modifier_3d.cpp:120,
      // :133, :146), so the only bound is the PROPERTY_HINT_FLAGS widget: a
      // warning under ADR-0032, never an error.
      for (const leaf of FLAG_LEAVES) {
        const diagnostic = check(`settings/0/${leaf}`, '8');
        expect(diagnostic?.severity, `${leaf} = 8`).toBe('warning');
        expect(diagnostic?.message).toContain(leaf);
      }
    });

    it('warns on a negative mask, which the widget cannot express either', () => {
      expect(check('settings/0/copy', '-1')?.severity).toBe('warning');
    });

    it('rejects a non-integer mask as a format error', () => {
      const error = check('settings/0/axes', 'true');
      expect(error?.severity).toBe('error');
    });
  });

  describe('settings/<i>/relative and additive', () => {
    it('accepts both booleans', () => {
      for (const leaf of ['relative', 'additive']) {
        expect(check(`settings/0/${leaf}`, 'true')).toBeNull();
        expect(check(`settings/0/${leaf}`, 'false')).toBeNull();
      }
    });

    it('rejects anything that is not a boolean literal', () => {
      expect(check('settings/0/relative', '1')).not.toBeNull();
      expect(check('settings/0/additive', 'yes')).not.toBeNull();
    });

    it('accepts relative on a node-referencing setting, where it is inert', () => {
      // copy_transform_modifier_3d.cpp:107-109 hides the key when the setting
      // references a node, so Godot omits it from the save, and
      // `is_relative()` then reads false whatever is stored
      // (copy_transform_modifier_3d.h:61-66). set_relative still assigns
      // (copy_transform_modifier_3d.cpp:303), so a scene carrying it is inert,
      // not invalid: no removal, no rule, no diagnostic.
      expect(check('settings/1/relative', 'true')).toBeNull();
    });
  });

  describe('the settings/ key shape', () => {
    it('validates every index, not just the first', () => {
      expect(check('settings/12/copy', '3')).toBeNull();
      expect(check('settings/12/copy', '9')?.severity).toBe('warning');
    });

    it('rejects a negative index, which _set refuses outright', () => {
      // copy_transform_modifier_3d.cpp:39, `ERR_FAIL_INDEX_V(which, …)`.
      const error = check('settings/-1/copy', '7');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('-1');
    });

    it('rejects a key that is not <prefix><index>/<leaf>', () => {
      // The registry's own matcher refuses the shape first, so no validator
      // claims the key at all: `settings/copy` has no index and `settings/0/`
      // no leaf, and Godot's `_set` would read neither.
      for (const malformed of ['settings/copy', 'settings/0/']) {
        expect(validatorRegistry.findValidator('CopyTransformModifier3D', malformed)).toBeNull();
      }
      // Handed one anyway — which is what the registered PATTERN itself is when
      // the sweep above validates `settings/#/*` — the dispatcher rejects it
      // rather than forwarding an unparseable key to the base.
      const dispatcher = validatorRegistry.findValidator(
        'CopyTransformModifier3D',
        'settings/0/copy'
      );
      expect(dispatcher!('settings/copy', '7', 1)).not.toBeNull();
      expect(dispatcher!('settings/0/', '7', 1)).not.toBeNull();
    });
  });

  describe('leaves BoneConstraint3D owns', () => {
    it('hands an unowned leaf to BoneConstraint3D instead of rejecting it', () => {
      // `settings/0/amount` is BoneConstraint3D::get_property_list's
      // (bone_constraint_3d.cpp:102), not this class's. Rejecting it would
      // false-positive on every real scene, so the dispatcher forwards.
      const dispatcher = validatorRegistry.findValidator(
        'CopyTransformModifier3D',
        'settings/0/amount'
      );
      const spy = vi.spyOn(validatorRegistry, 'findValidator');
      expect(dispatcher!('settings/0/amount', '0.5', 1)).toBeNull();
      expect(spy).toHaveBeenCalledWith('BoneConstraint3D', 'settings/0/amount');
      spy.mockRestore();
    });

    it('accepts the base leaves a real scene writes', () => {
      expect(check('settings/0/apply_bone_name', '"Bone"')).toBeNull();
      expect(check('settings/0/reference_type', '1')).toBeNull();
      expect(check('settings/1/reference_node', 'NodePath("../../Target")')).toBeNull();
    });

    it('accepts the unresolved -1 bone indices a saved scene carries', () => {
      // `apply_bone` and `reference_bone` are PROPERTY_USAGE_NO_EDITOR INTs
      // (bone_constraint_3d.cpp:104, :107), so they DO serialise, and both
      // default to -1 (bone_constraint_3d.h:48, :53). Whoever declares the base
      // family must not floor them at 0.
      expect(check('settings/0/apply_bone', '-1')).toBeNull();
      expect(check('settings/0/reference_bone', '-1')).toBeNull();
    });
  });

  describe('the base-class walk', () => {
    it('resolves an inherited key without re-declaring it here', () => {
      // SkeletonModifier3D's, two hops up through the empty BoneConstraint3D.
      expect(validatorRegistry.findValidator('CopyTransformModifier3D', 'influence')).not.toBeNull();
      expect(validatorRegistry.findValidator('CopyTransformModifier3D', 'active')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('CopyTransformModifier3D')).not.toContain('influence');
      expect(validatorRegistry.getOwnKeys('CopyTransformModifier3D')).not.toContain('active');
    });
  });
});
