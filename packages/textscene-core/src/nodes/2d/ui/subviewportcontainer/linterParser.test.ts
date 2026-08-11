/**
 * SubViewportContainer's own validator, pinned directly against the registry
 * rather than through a full scene, per `subviewport_container.cpp`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SubViewportContainer', property);
  expect(validator, `no validator registered for SubViewportContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SubViewportContainer validators', () => {
  describe('mouse_target', () => {
    // subviewport_container.cpp:249-251 — `set_mouse_target` is a bare
    // assignment, no ERR_FAIL and no hint on the BOOL property
    // (subviewport_container.cpp:302), so format-only like every other bool.
    it('accepts true and false', () => {
      expect(check('mouse_target', 'true')).toBeNull();
      expect(check('mouse_target', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('mouse_target', 'sure');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });
});
