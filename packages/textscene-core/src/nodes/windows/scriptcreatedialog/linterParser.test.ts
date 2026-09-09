/**
 * ScriptCreateDialog strict validators: coverage check.
 *
 * ScriptCreateDialog declares no property of its own (see linterParser.ts for
 * how that was established), so there is no format/bound behaviour to
 * exercise here. What this asserts instead: the registration is genuinely
 * empty, and the base-walk still reaches ConfirmationDialog's, AcceptDialog's
 * and Window's own keys through it. Asserted through `validatorRegistry`
 * rather than `Linter`, since `linter/index.ts` imports every sibling slice
 * and is being edited concurrently elsewhere.
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
