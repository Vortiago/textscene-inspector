/**
 * Tests the MenuBar strict validators through `validatorRegistry`, so a failure points at the
 * validator, not at scene parsing, and no fixture text needs upkeep. One case per property, with the
 * Godot source line beside every numeric bound. Rule behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MenuBar', property);
  expect(validator, `no validator registered for MenuBar.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source: the keys MenuBar binds, or DECLARES_NOTHING when it binds no
 * ADD_PROPERTY. Both unset is red on purpose. Never delete an assertion to go green.
 */
const KEYS: string[] = [
  // The six ADD_PROPERTY calls in MenuBar::_bind_methods (menu_bar.cpp:751-758). `focus_mode` is not
  // among them: doc/classes/MenuBar.xml:103 marks it overrides="Control", a default change only.
  'flat',
  'start_index',
  'switch_on_hover',
  'prefer_global_menu',
  'text_direction',
  'language',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('MenuBar strict validators', () => {
  it('registers exactly what MenuBar binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MenuBar').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's zero-diagnostic claim against what this test imports. `fixtureLint` runs the
    // whole registry but needs the barrel, which imports every slice.
    expectFixtureClean('unit-menu-bar.tscn');
  });

  describe('flat', () => {
    // menu_bar.cpp:751 `ADD_PROPERTY(PropertyInfo(Variant::BOOL, "flat"), ...)`.
    it('accepts both boolean literals', () => {
      expect(check('flat', 'true')).toBeNull();
      expect(check('flat', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('flat', '1')).not.toBeNull();
    });

    it('rejects a quoted boolean, which Godot writes unquoted', () => {
      expect(check('flat', '"true"')).not.toBeNull();
    });
  });

  describe('switch_on_hover and prefer_global_menu', () => {
    // menu_bar.cpp:753 and :754, both `Variant::BOOL` with no hint.
    it.each(['switch_on_hover', 'prefer_global_menu'])('accepts both literals for %s', (key) => {
      expect(check(key, 'true')).toBeNull();
      expect(check(key, 'false')).toBeNull();
    });

    it.each(['switch_on_hover', 'prefer_global_menu'])('rejects an integer for %s', (key) => {
      expect(check(key, '0')).not.toBeNull();
    });

    it('rejects a capitalised literal, which the TSCN grammar does not carry', () => {
      expect(check('switch_on_hover', 'True')).not.toBeNull();
    });
  });

  describe('start_index', () => {
    // menu_bar.cpp:752 `PropertyInfo(Variant::INT, "start_index")` has no hint, so no end is bounded,
    // and set_start_index (menu_bar.cpp:836-844) stores whatever it is given.
    it('accepts the -1 default and any non-negative position', () => {
      expect(check('start_index', '-1')).toBeNull();
      expect(check('start_index', '0')).toBeNull();
      expect(check('start_index', '7')).toBeNull();
    });

    it('accepts a value far outside any plausible menu count, because nothing bounds it', () => {
      // A large index is not clamped: bind_global_menu (menu_bar.cpp:229-244) finds no earlier MenuBar
      // and appends at the end.
      expect(check('start_index', '100000')).toBeNull();
      expect(check('start_index', '-9999')).toBeNull();
    });

    it('rejects a fractional value, which no integer index spells', () => {
      expect(check('start_index', '1.5')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('start_index', 'first')).not.toBeNull();
    });
  });

  describe('text_direction', () => {
    it('accepts every value the hint names', () => {
      // menu_bar.cpp:757 PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited".
      for (const value of ['0', '1', '2', '3']) {
        expect(check('text_direction', value), `rejected ${value}`).toBeNull();
      }
    });

    it('warns on -1: the setter loads it, the hint does not offer it', () => {
      // The setter allows it, since its ERR_FAIL_COND opens below -1, so it loads. The hint (0-3)
      // does not offer it, so it warns instead of erroring.
      expect(check('text_direction', '-1')?.severity).toBe('warning');
    });

    it('errors below the enforced floor', () => {
      const error = check('text_direction', '-2');
      expect(error).not.toBeNull();
      // The setter refuses the write, so this is the error tier, not the hint's warning tier.
      expect(error!.severity).toBe('error');
    });

    it('errors above the enforced ceiling', () => {
      const error = check('text_direction', '4');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });

    it('rejects a symbolic constant name, which TSCN never carries for an int enum', () => {
      expect(check('text_direction', 'TEXT_DIRECTION_RTL')).not.toBeNull();
    });
  });

  describe('language', () => {
    it('accepts a quoted locale id and the empty default', () => {
      // menu_bar.cpp:758 PROPERTY_HINT_LOCALE_ID with an empty hint string. set_language
      // (menu_bar.cpp:813-819) assigns any string.
      expect(check('language', '"en"')).toBeNull();
      expect(check('language', '"nb_NO"')).toBeNull();
      expect(check('language', '""')).toBeNull();
    });

    it('accepts a string no locale registry knows, because the setter does not check', () => {
      expect(check('language', '"not-a-real-locale"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en')).not.toBeNull();
    });

    it('rejects a value that closes and reopens its quotes', () => {
      expect(check('language', '"en" junk "US"')).not.toBeNull();
    });
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This generic check also catches a
    // key added above without one.
    const accepted = validatorRegistry
      .getOwnKeys('MenuBar')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});
