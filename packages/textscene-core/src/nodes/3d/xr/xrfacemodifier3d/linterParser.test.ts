/**
 * XRFaceModifier3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('XRFaceModifier3D', property);
  expect(validator, `no validator registered for XRFaceModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** The two ADD_PROPERTY calls in `XRFaceModifier3D::_bind_methods` (xr_face_modifier_3d.cpp:495-503). */
const KEYS: string[] = ['face_tracker', 'target'];
const DECLARES_NOTHING = false;

describe('XRFaceModifier3D strict validators', () => {
  it('registers exactly what XRFaceModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XRFaceModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-xr-face-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('XRFaceModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('face_tracker', () => {
    it('accepts the documented default, &"/user/face_tracker"', () => {
      expect(check('face_tracker', '&"/user/face_tracker"')).toBeNull();
    });

    it('accepts a plain quoted string, which the variant text parser also reads as a StringName', () => {
      expect(check('face_tracker', '"/user/other_tracker"')).toBeNull();
    });

    it('rejects an unquoted bare word', () => {
      expect(check('face_tracker', 'face_tracker')).not.toBeNull();
    });
  });

  describe('target', () => {
    it('accepts a NodePath to a MeshInstance3D', () => {
      expect(check('target', 'NodePath("../MeshInstance3D")')).toBeNull();
    });

    it('accepts the empty NodePath, the documented default', () => {
      expect(check('target', 'NodePath("")')).toBeNull();
    });

    it('accepts a path to a node that is not a MeshInstance3D', () => {
      // PROPERTY_HINT_NODE_PATH_VALID_TYPES "MeshInstance3D"
      // (xr_face_modifier_3d.cpp:502) filters the inspector's node picker;
      // set_target (cpp:517-523) is a bare assignment with no type check.
      expect(check('target', 'NodePath("../NotAMesh")')).toBeNull();
    });

    it('rejects a bare quoted string that is not a NodePath literal', () => {
      expect(check('target', '"../MeshInstance3D"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Node3D key (transform) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('XRFaceModifier3D', 'transform')).not.toBeNull();
    });

    it('does not re-declare that inherited key as its own', () => {
      expect(validatorRegistry.getOwnKeys('XRFaceModifier3D')).not.toContain('transform');
    });
  });
});
