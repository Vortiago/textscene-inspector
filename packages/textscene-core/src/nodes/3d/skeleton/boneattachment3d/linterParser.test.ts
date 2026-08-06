/**
 * BoneAttachment3D strict validators: format checks, and one bound that is
 * deliberately absent.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('BoneAttachment3D', property);
  expect(validator, `no validator registered for BoneAttachment3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The five `ADD_PROPERTY` calls in `BoneAttachment3D::_bind_methods`
 * (bone_attachment_3d.cpp:376-380). They are the whole own surface: the class
 * binds no `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no `_set`/`_get`/
 * property-list override, and `bone_attachment_3d.compat.inc` (included at
 * cpp:32) binds only compatibility METHODS. `_validate_property`
 * (cpp:34-58) only re-hints `bone_name` and hides `external_skeleton`; it
 * declares nothing new.
 *
 * `physics_interpolation_mode` is Node's, carrying `overrides=` in the XML, so
 * it arrives through the base-walk and is not re-declared here.
 */
const KEYS: string[] = [
  'bone_name',
  'bone_idx',
  'override_pose',
  'use_external_skeleton',
  'external_skeleton',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('BoneAttachment3D strict validators', () => {
  it('registers exactly what BoneAttachment3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('BoneAttachment3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-bone-attachment-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('BoneAttachment3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('bone_name', () => {
    it('accepts the quoted string Godot writes', () => {
      // The getter returns `String` (bone_attachment_3d.cpp:186) behind a
      // STRING_NAME declaration (cpp:376), so the saved form is plain quoted.
      expect(check('bone_name', '"Head"')).toBeNull();
    });

    it('accepts the &"…" StringName literal the declared type suggests', () => {
      expect(check('bone_name', '&"Head"')).toBeNull();
    });

    it('accepts the empty string, the documented default (BoneAttachment3D.xml:29)', () => {
      expect(check('bone_name', '""')).toBeNull();
    });

    it('accepts a name no skeleton has, which the setter stores unchanged', () => {
      // set_bone_name (cpp:178-184) assigns first and only then resolves the
      // name against a skeleton, so an unknown name is kept, not refused.
      expect(check('bone_name', '"NoSuchBone"')).toBeNull();
    });

    it('rejects an unquoted bare word', () => {
      expect(check('bone_name', 'Head')).not.toBeNull();
    });
  });

  describe('bone_idx', () => {
    it('accepts a bone index', () => {
      expect(check('bone_idx', '3')).toBeNull();
    });

    it('accepts -1, the documented default (BoneAttachment3D.xml:26)', () => {
      expect(check('bone_idx', '-1')).toBeNull();
    });

    it('errors below -1, because the setter rewrites it rather than keeping it', () => {
      // set_bone_idx (bone_attachment_3d.cpp:190-214) assigns first, then, once a
      // Skeleton3D resolves, rewrites anything `<= -1` or past the bone count back
      // to -1 (cpp:201). The question is not whether -1 is swallowed but whether
      // -2 is ALTERED, and it is: it comes back as -1. That is ADR-0032's enforced
      // tier. ChainIK3D, ModifierBoneTarget3D and LimitAngularVelocityModifier3D
      // all ground the byte-identical setter the same way.
      expect(check('bone_idx', '-2')?.severity).toBe('error');
    });

    it('accepts a huge index, since the ceiling is a live bone count', () => {
      expect(check('bone_idx', '99999')).toBeNull();
    });

    it('rejects a fractional index, which is not a discrete bone', () => {
      expect(check('bone_idx', '2.5')).not.toBeNull();
    });

    it('rejects a non-numeric index', () => {
      expect(check('bone_idx', '"Head"')).not.toBeNull();
    });
  });

  describe('override_pose', () => {
    it('accepts false, the documented default (BoneAttachment3D.xml:35)', () => {
      expect(check('override_pose', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('override_pose', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('override_pose', 'override')).not.toBeNull();
    });
  });

  describe('use_external_skeleton', () => {
    it('accepts false, the documented default (BoneAttachment3D.xml:40)', () => {
      expect(check('use_external_skeleton', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('use_external_skeleton', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('use_external_skeleton', 'external')).not.toBeNull();
    });
  });

  describe('external_skeleton', () => {
    it('accepts the relative NodePath Godot writes', () => {
      expect(check('external_skeleton', 'NodePath("../Skeleton3D")')).toBeNull();
    });

    it('accepts an empty NodePath, the state the flag starts in', () => {
      expect(check('external_skeleton', 'NodePath("")')).toBeNull();
    });

    it('accepts a path to a node that is not a Skeleton3D', () => {
      // The PROPERTY_HINT_NODE_PATH_VALID_TYPES "Skeleton3D" at cpp:380 filters
      // the inspector's node picker; set_external_skeleton (cpp:259-263) stores
      // whatever it is handed, and the type check happens later, on the
      // resolved node (cpp:88-89).
      expect(check('external_skeleton', 'NodePath("../NotASkeleton")')).toBeNull();
    });

    it('rejects a bare quoted string that is not a NodePath literal', () => {
      expect(check('external_skeleton', '"../Skeleton3D"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Node3D key (transform) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('BoneAttachment3D', 'transform')).not.toBeNull();
    });

    it('does not re-declare that inherited key as its own', () => {
      // A shadowing copy would duplicate the rule and drift from Node3D's.
      expect(validatorRegistry.getOwnKeys('BoneAttachment3D')).not.toContain('transform');
    });
  });
});
