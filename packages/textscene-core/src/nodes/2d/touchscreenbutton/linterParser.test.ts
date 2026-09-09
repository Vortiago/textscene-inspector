/**
 * TouchScreenButton strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TouchScreenButton', property);
  expect(validator, `no validator registered for TouchScreenButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The nine `ADD_PROPERTY` calls in `TouchScreenButton::_bind_methods`
 * (touch_screen_button.cpp:434-442). They are the whole own surface: no
 * `PropertyListHelper`, no `ADD_ARRAY_COUNT`, and the `_set` override
 * (cpp:392-402) is a load-only Godot-3.x compatibility shim with no matching
 * `_get`, so it serialises nothing new.
 */
const KEYS: string[] = [
  'texture_normal',
  'texture_pressed',
  'bitmask',
  'shape',
  'shape_centered',
  'shape_visible',
  'passby_press',
  'action',
  'visibility_mode',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys TouchScreenButton does NOT declare, each paired with the ancestor that does.
 */
const INHERITED: [owner: string, key: string][] = [['Node2D', 'position']];

describe('TouchScreenButton strict validators', () => {
  it('registers exactly what TouchScreenButton binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('TouchScreenButton').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-touch-screen-button.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('TouchScreenButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('texture_normal', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_normal', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_normal', 'ExtResource("1_marker")')).toBeNull();
    });

    it('rejects a bare unquoted word', () => {
      expect(check('texture_normal', 'nonsense')).not.toBeNull();
    });
  });

  describe('texture_pressed', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_pressed', 'SubResource("PlaceholderTexture2D_2")')).toBeNull();
    });

    it('rejects a bare unquoted word', () => {
      expect(check('texture_pressed', 'nonsense')).not.toBeNull();
    });
  });

  describe('bitmask', () => {
    it('accepts a SubResource BitMap reference', () => {
      expect(check('bitmask', 'SubResource("BitMap_1")')).toBeNull();
    });

    it('rejects a bare unquoted word', () => {
      expect(check('bitmask', 'nonsense')).not.toBeNull();
    });
  });

  describe('shape', () => {
    it('accepts a SubResource Shape2D reference', () => {
      expect(check('shape', 'SubResource("CircleShape2D_1")')).toBeNull();
    });

    it('rejects a bare unquoted word', () => {
      expect(check('shape', 'nonsense')).not.toBeNull();
    });
  });

  describe('shape_centered', () => {
    it('accepts true, the documented default (TouchScreenButton.xml:35)', () => {
      expect(check('shape_centered', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('shape_centered', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('shape_centered', 'centered')).not.toBeNull();
    });
  });

  describe('shape_visible', () => {
    it('accepts true, the documented default (TouchScreenButton.xml:38)', () => {
      expect(check('shape_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('shape_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('shape_visible', 'visible')).not.toBeNull();
    });
  });

  describe('passby_press', () => {
    it('accepts false, the documented default (TouchScreenButton.xml:28)', () => {
      expect(check('passby_press', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('passby_press', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('passby_press', 'press')).not.toBeNull();
    });
  });

  describe('action', () => {
    it('accepts the plain quoted string Godot actually saves (get_action returns String)', () => {
      expect(check('action', '"ui_accept"')).toBeNull();
    });

    it('accepts the &"…" StringName literal the declared type suggests', () => {
      expect(check('action', '&"ui_accept"')).toBeNull();
    });

    it('accepts the empty string, the documented default (TouchScreenButton.xml:22)', () => {
      expect(check('action', '""')).toBeNull();
    });

    it('accepts an action no InputMap declares, since existence is out of scope', () => {
      // PROPERTY_HINT_INPUT_NAME (cpp:441) only feeds the editor's picker;
      // set_action (cpp:220-222) assigns unconditionally, and this linter has
      // no project file to resolve the name against.
      expect(check('action', '"no_such_action"')).toBeNull();
    });

    it('rejects an unquoted bare word', () => {
      expect(check('action', 'ui_accept')).not.toBeNull();
    });
  });

  describe('visibility_mode', () => {
    it('accepts 0 (VISIBILITY_ALWAYS), the documented default (TouchScreenButton.xml:47)', () => {
      expect(check('visibility_mode', '0')).toBeNull();
    });

    it('accepts 1 (VISIBILITY_TOUCHSCREEN_ONLY)', () => {
      expect(check('visibility_mode', '1')).toBeNull();
    });

    it('warns above the hint range, since set_visibility_mode assigns unchecked', () => {
      // touch_screen_button.cpp:374-377 has no ERR_FAIL_INDEX, and the header
      // enum (touch_screen_button.h:42-45) declares no MAX sentinel — only the
      // PROPERTY_HINT_ENUM at cpp:442 states the bound, so this is a warning
      // (ADR-0032), not an error.
      expect(check('visibility_mode', '2')?.severity).toBe('warning');
    });

    it('warns below the hint range too, the same bare-string grounding covering both ends', () => {
      expect(check('visibility_mode', '-1')?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('visibility_mode', 'always')).not.toBeNull();
    });
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key TouchScreenButton inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // TouchScreenButton would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('TouchScreenButton', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('TouchScreenButton')).not.toContain(key);
    }
  });
});
