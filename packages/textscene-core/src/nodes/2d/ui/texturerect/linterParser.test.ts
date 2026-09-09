/**
 * TextureRect strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. `expectFixtureClean` below still runs the
 * committed fixture through the real `StrictTscnParser`, but the fixture is
 * not extended to carry every property this file validates (see below).
 *
 * No `linter.ts` exists for this slice: `texture_rect.cpp`/`.h` has no
 * `_validate_property`, no `WARN_PRINT`, and no `get_configuration_warnings`
 * override, so there is no engine-grounded cross-field rule to encode.
 *
 * `flip_h`/`flip_v` are not exercised by `unit-texture-rect.tscn`. Extending it
 * would either write `flip_h = true`, which mirrors the texture and desyncs
 * the committed `docs/comparison/images/unit-texture-rect-{godot,ours}.png`
 * pair and the comparison.md "Properties exercised" table (frozen by this
 * slice's brief, and AGENTS.md's one-variable-per-golden rule blocks a
 * re-bake this wave), or write `flip_h = false`, which is Godot's default and
 * so a line the real serializer never emits: a fixture is a claim about what
 * Godot writes, and a default-valued line would misstate that. Both booleans
 * get full happy/error coverage through direct validator calls instead.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

const OWN_KEYS = ['expand_mode', 'flip_h', 'flip_v', 'stretch_mode', 'texture'];

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TextureRect', property);
  expect(validator, `no validator registered for TextureRect.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('TextureRect strict validators', () => {
  it('registers exactly its five own members', () => {
    expect(validatorRegistry.getOwnKeys('TextureRect').sort()).toEqual([...OWN_KEYS].sort());
  });

  it('does not re-register mouse_filter: it carries overrides="Control" in the XML (only its default, MOUSE_FILTER_PASS, changes, in the TextureRect() constructor)', () => {
    expect(validatorRegistry.getOwnKeys('TextureRect')).not.toContain('mouse_filter');
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-texture-rect.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases below are the real check.
    const accepted = validatorRegistry
      .getOwnKeys('TextureRect')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // texture_rect.cpp:207-215, set_expand_mode: assigns straight through with
  // no ERR_FAIL_INDEX (only an early-return on a redundant set); the
  // ADD_PROPERTY hint at :148 only constrains the editor.
  describe('expand_mode', () => {
    it('accepts 0 (EXPAND_KEEP_SIZE, the documented default)', () => {
      expect(check('expand_mode', '0')).toBeNull();
    });

    it('accepts 1 (EXPAND_IGNORE_SIZE)', () => {
      expect(check('expand_mode', '1')).toBeNull();
    });

    it('accepts 5 (EXPAND_FIT_HEIGHT_PROPORTIONAL, the top of the range)', () => {
      expect(check('expand_mode', '5')).toBeNull();
    });

    it('warns, does not error, below the enum (-1): set_expand_mode has no ERR_FAIL_INDEX', () => {
      const error = check('expand_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above the enum (6), same reason', () => {
      const error = check('expand_mode', '6');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('expand_mode', 'fit')).not.toBeNull();
    });
  });

  // texture_rect.cpp:234-241, set_flip_h assigns straight through
  describe('flip_h', () => {
    it('accepts true', () => {
      expect(check('flip_h', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('flip_h', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('flip_h', 'sideways')).not.toBeNull();
    });
  });

  // texture_rect.cpp:247-254, set_flip_v, same shape as flip_h
  describe('flip_v', () => {
    it('accepts true', () => {
      expect(check('flip_v', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('flip_v', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('flip_v', 'upside-down')).not.toBeNull();
    });
  });

  // texture_rect.cpp:221-228, set_stretch_mode: same shape as expand_mode,
  // and the same shape as TextureButton's stretch_mode (texture_button.cpp:
  // 383-390), unlike TextureProgressBar's ERR_FAIL_INDEX-enforced fill_mode.
  describe('stretch_mode', () => {
    it('accepts 0 (STRETCH_SCALE, the documented default)', () => {
      expect(check('stretch_mode', '0')).toBeNull();
    });

    it('accepts 5 (STRETCH_KEEP_ASPECT_CENTERED)', () => {
      expect(check('stretch_mode', '5')).toBeNull();
    });

    it('accepts 6 (STRETCH_KEEP_ASPECT_COVERED, the top of the range)', () => {
      expect(check('stretch_mode', '6')).toBeNull();
    });

    it('warns, does not error, below the enum (-1): set_stretch_mode has no ERR_FAIL_INDEX', () => {
      const error = check('stretch_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above the enum (7), same reason', () => {
      const error = check('stretch_mode', '7');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('stretch_mode', 'scale')).not.toBeNull();
    });
  });

  // texture_rect.cpp:184-201, set_texture assigns straight through
  describe('texture', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("1_tex")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture', '"res://icon.png"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Control key (anchor_right) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('TextureRect', 'anchor_right')).not.toBeNull();
    });

    it('resolves a CanvasItem key (modulate) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('TextureRect', 'modulate')).not.toBeNull();
    });
  });
});
