/**
 * OpenXRRenderModelManager strict validators, asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator and no fixture text needs upkeep. Rule-level
 * behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('OpenXRRenderModelManager', property);
  expect(validator, `no validator registered for OpenXRRenderModelManager.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** The two ADD_PROPERTY calls in `OpenXRRenderModelManager::_bind_methods` (cpp:41-57). */
const KEYS: string[] = ['tracker', 'make_local_to_pose'];
const DECLARES_NOTHING = false;

describe('OpenXRRenderModelManager strict validators', () => {
  it('registers exactly what OpenXRRenderModelManager binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRRenderModelManager').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-render-model-manager.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRRenderModelManager')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('tracker', () => {
    it('accepts Any (0)', () => {
      expect(check('tracker', '0')).toBeNull();
    });

    it('accepts None set (1)', () => {
      expect(check('tracker', '1')).toBeNull();
    });

    it('accepts Left Hand (2)', () => {
      expect(check('tracker', '2')).toBeNull();
    });

    it('accepts Right Hand (3)', () => {
      expect(check('tracker', '3')).toBeNull();
    });

    it('warns, not errors, past the ENUM hint, since set_tracker assigns unconditionally', () => {
      // openxr_render_model_manager.cpp:228-230: `tracker = p_tracker;` runs
      // before any guard, and the only guard (cpp:248) neither runs at
      // scene-load time nor reverts the assignment when it does.
      expect(check('tracker', '4')?.severity).toBe('warning');
    });
  });

  describe('make_local_to_pose', () => {
    it('accepts a quoted pose name', () => {
      expect(check('make_local_to_pose', '"aim"')).toBeNull();
    });

    it('accepts the empty string, the documented default', () => {
      expect(check('make_local_to_pose', '""')).toBeNull();
    });

    it('accepts a pose name Godot does not suggest', () => {
      // PROPERTY_HINT_ENUM_SUGGESTION "aim,grip" (cpp:48) only seeds the
      // inspector's autocomplete; set_make_local_to_pose (cpp:272-282) assigns
      // straight through.
      expect(check('make_local_to_pose', '"palm"')).toBeNull();
    });

    it('rejects an unquoted bare word', () => {
      expect(check('make_local_to_pose', 'aim')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Node3D key (transform) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('OpenXRRenderModelManager', 'transform')).not.toBeNull();
    });

    it('does not re-declare that inherited key as its own', () => {
      expect(validatorRegistry.getOwnKeys('OpenXRRenderModelManager')).not.toContain('transform');
    });
  });
});
