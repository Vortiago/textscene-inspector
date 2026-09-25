/**
 * ScriptCreateDialog strict validators: the registration is empty, and the base walk
 * still reaches ConfirmationDialog's, AcceptDialog's and Window's keys. Asserted
 * through `validatorRegistry`, since `linter/index.ts` imports every sibling slice.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ScriptCreateDialog', property);
  expect(validator, `no validator registered for ScriptCreateDialog.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ScriptCreateDialog strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ScriptCreateDialog')).toEqual([]);
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited ConfirmationDialog key (cancel_button_text)', () => {
      expect(check('cancel_button_text', '"No thanks"')).toBeNull();
    });

    it('resolves an inherited AcceptDialog key (ok_button_text) two hops up', () => {
      expect(check('ok_button_text', '"Create"')).toBeNull();
    });

    it('resolves an inherited Window key (title) three hops up', () => {
      expect(check('title', '"Attach Node Script"')).toBeNull();
    });
  });
});
