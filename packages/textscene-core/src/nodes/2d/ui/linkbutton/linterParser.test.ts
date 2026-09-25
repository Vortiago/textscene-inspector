/**
 * Tests the LinkButton strict validators through `validatorRegistry`, so a failure points at the
 * validator, not at scene parsing. LinkButton has no cross-field rule, so no `linter.ts`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('LinkButton', property);
  expect(validator, `no validator registered for LinkButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('LinkButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('LinkButton')).not.toEqual([]);
  });

  it('registers exactly the 9 own members doc/classes/LinkButton.xml lists without an overrides= attribute', () => {
    expect(validatorRegistry.getOwnKeys('LinkButton').sort()).toEqual([
      'ellipsis_char',
      'language',
      'structured_text_bidi_override',
      'structured_text_bidi_override_options',
      'text',
      'text_direction',
      'text_overrun_behavior',
      'underline',
      'uri',
    ]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. Per-property cases follow this
    // generic check.
    const accepted = validatorRegistry
      .getOwnKeys('LinkButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('text', () => {
    it('accepts a quoted string', () => {
      expect(check('text', '"Visit our site"')).toBeNull();
    });

    it('accepts an empty string', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('text', 'Visit our site')).not.toBeNull();
    });
  });

  describe('uri', () => {
    it('accepts a URL', () => {
      expect(check('uri', '"https://godotengine.org"')).toBeNull();
    });

    it('accepts an empty string: pressed() (link_button.cpp:185-191) no-ops on an empty uri rather than failing', () => {
      expect(check('uri', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('uri', 'https://godotengine.org')).not.toBeNull();
    });
  });

  describe('underline', () => {
    it('accepts 0 (ALWAYS)', () => {
      expect(check('underline', '0')).toBeNull();
    });

    it('accepts 1 (ON_HOVER), the value the fixture carries', () => {
      expect(check('underline', '1')).toBeNull();
    });

    it('accepts 2 (NEVER), the last entry the hint names', () => {
      expect(check('underline', '2')).toBeNull();
    });

    it('rejects 3, one past the enum', () => {
      expect(check('underline', '3')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('underline', '-1')).not.toBeNull();
    });
  });

  describe('ellipsis_char', () => {
    it('accepts the default single-character ellipsis', () => {
      expect(check('ellipsis_char', '"…"')).toBeNull();
    });

    it('accepts a single ASCII character', () => {
      expect(check('ellipsis_char', '"."')).toBeNull();
    });

    it('accepts an empty string: set_ellipsis_char (link_button.cpp:91-108) only clamps length > 1', () => {
      expect(check('ellipsis_char', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('ellipsis_char', '.')).not.toBeNull();
    });

    it('rejects more than one character: set_ellipsis_char (link_button.cpp:93-96) silently truncates to the first character rather than accepting the literal as written', () => {
      expect(check('ellipsis_char', '"..."')).not.toBeNull();
    });
  });

  describe('text_overrun_behavior', () => {
    it('accepts 3 (OVERRUN_TRIM_ELLIPSIS)', () => {
      expect(check('text_overrun_behavior', '3')).toBeNull();
    });

    it('accepts 6, the last of the 7 entries the hint names', () => {
      expect(check('text_overrun_behavior', '6')).toBeNull();
    });

    it('rejects 7, one past the enum', () => {
      expect(check('text_overrun_behavior', '7')).not.toBeNull();
    });
  });

  describe('text_direction', () => {
    it('accepts 0 (AUTO), 1 (LTR) and 2 (RTL)', () => {
      expect(check('text_direction', '0')).toBeNull();
      expect(check('text_direction', '1')).toBeNull();
      expect(check('text_direction', '2')).toBeNull();
    });

    it('accepts 3 (INHERITED), the last entry the hint names', () => {
      expect(check('text_direction', '3')).toBeNull();
    });

    it('warns on -1: the setter loads it, the hint does not offer it', () => {
      // The setter allows it, since its ERR_FAIL_COND opens below -1, so it loads. The hint (0-3)
      // does not offer it, so it warns instead of erroring.
      expect(check('text_direction', '-1')?.severity).toBe('warning');
    });

    it('rejects 4, past the ERR_FAIL_COND the setter enforces', () => {
      expect(check('text_direction', '4')).not.toBeNull();
    });

    it('rejects -2, past the ERR_FAIL_COND on the other side', () => {
      expect(check('text_direction', '-2')).not.toBeNull();
    });
  });

  describe('language', () => {
    it('accepts a locale id', () => {
      expect(check('language', '"en_GB"')).toBeNull();
    });

    it('accepts an empty string, which means the current locale', () => {
      expect(check('language', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en_GB')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override', () => {
    it('accepts 0 (DEFAULT)', () => {
      expect(check('structured_text_bidi_override', '0')).toBeNull();
    });

    it('accepts 6 (CUSTOM), the last entry the hint names', () => {
      expect(check('structured_text_bidi_override', '6')).toBeNull();
    });

    it('rejects 7, one past the enum', () => {
      expect(check('structured_text_bidi_override', '7')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('structured_text_bidi_override', '-1')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override_options', () => {
    it('accepts an empty Array literal', () => {
      expect(check('structured_text_bidi_override_options', '[]')).toBeNull();
    });

    it('accepts a populated Array literal: the parser interprets its contents, not this validator', () => {
      expect(check('structured_text_bidi_override_options', '["a", "b"]')).toBeNull();
    });

    it('rejects a value that is not an Array literal', () => {
      expect(check('structured_text_bidi_override_options', '"nope"')).not.toBeNull();
    });
  });

  it('never re-declares focus_mode or mouse_default_cursor_shape, which both carry overrides="Control"', () => {
    expect(validatorRegistry.getOwnKeys('LinkButton')).not.toContain('focus_mode');
    expect(validatorRegistry.getOwnKeys('LinkButton')).not.toContain('mouse_default_cursor_shape');
  });

  it('resolves inherited keys through the base-walk', () => {
    // BaseButton, Control and CanvasItem keys must reach a LinkButton without
    // being re-declared here.
    expect(validatorRegistry.findValidator('LinkButton', 'toggle_mode')).not.toBeNull();
    expect(validatorRegistry.findValidator('LinkButton', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('LinkButton', 'modulate')).not.toBeNull();
  });

  it('does not resolve Button-only keys: LinkButton descends from BaseButton, not Button', () => {
    expect(validatorRegistry.findValidator('LinkButton', 'alignment')).toBeNull();
  });
});
