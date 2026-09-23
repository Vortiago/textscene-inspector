/**
 * Tests the Parallax2D strict validators through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Parallax2D', property);
  expect(validator, `no validator registered for Parallax2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one: the keys Parallax2D binds, or DECLARES_NOTHING. Both unset is
 * red on purpose. parallax_2d.cpp:288-303 binds all ten. The XML's eleventh
 * member, `physics_interpolation_mode`, carries `overrides="Node"`.
 */
const KEYS: string[] = [
  'scroll_scale',
  'scroll_offset',
  'repeat_size',
  'autoscroll',
  'repeat_times',
  'limit_begin',
  'limit_end',
  'follow_viewport',
  'ignore_camera_scroll',
  'screen_offset',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys Parallax2D inherits, each with the ancestor that declares it. Not
 * `position`: `_validate_property` (parallax_2d.cpp:78-82) hides it behind
 * PROPERTY_USAGE_NONE, while `rotation` still serialises.
 */
const INHERITED: [owner: string, key: string][] = [['Node2D', 'rotation']];

describe('Parallax2D strict validators', () => {
  it('registers exactly what Parallax2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Parallax2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // `fixtureLint` covers the whole registry through the barrel. This checks
    // the fixture against only what this test imports.
    expectFixtureClean('unit-parallax-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. Vacuous when
    // the class declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('Parallax2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key Parallax2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy would
      // answer here while it drifts from the ancestor's rule.
      expect(validatorRegistry.findValidator('Parallax2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('Parallax2D')).not.toContain(key);
    }
  });

  describe('scroll_scale', () => {
    it('accepts the Godot default', () => {
      // doc/classes/Parallax2D.xml: default="Vector2(1, 1)".
      expect(check('scroll_scale', 'Vector2(1, 1)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('scroll_scale', 'not-a-vector');
      expect(error?.code).toBe('INVALID_SCROLL_SCALE_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a negative or zero value — PROPERTY_HINT_LINK is a UI toggle, not a range, and set_scroll_scale (parallax_2d.cpp:152-154) assigns straight through', () => {
      expect(check('scroll_scale', 'Vector2(-2, 0)')).toBeNull();
    });
  });

  describe('scroll_offset', () => {
    it('accepts the Godot default', () => {
      expect(check('scroll_offset', 'Vector2(0, 0)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('scroll_offset', 'not-a-vector');
      expect(error?.code).toBe('INVALID_SCROLL_OFFSET_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a negative value — set_scroll_offset (parallax_2d.cpp:190-196) assigns straight through', () => {
      expect(check('scroll_offset', 'Vector2(-500, 500)')).toBeNull();
    });
  });

  describe('repeat_size', () => {
    it('accepts the Godot default', () => {
      expect(check('repeat_size', 'Vector2(0, 0)')).toBeNull();
    });

    it('accepts a positive value', () => {
      expect(check('repeat_size', 'Vector2(512, 0)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('repeat_size', 'not-a-vector');
      expect(error?.code).toBe('INVALID_REPEAT_SIZE_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative component — the setter clamps it up to 0 (parallax_2d.cpp:165)', () => {
      const error = check('repeat_size', 'Vector2(-1, 0)');
      expect(error?.code).toBe('INVALID_REPEAT_SIZE_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('accepts `nan` silently — `nan < 0` is false, even though MAX(nan, 0) in the setter itself resolves to 0', () => {
      expect(check('repeat_size', 'Vector2(nan, 0)')).toBeNull();
    });

    it('errors on `-inf` the same way as any other negative component — MAX(-inf, 0) is 0', () => {
      const error = check('repeat_size', 'Vector2(-inf, 0)');
      expect(error?.code).toBe('INVALID_REPEAT_SIZE_VALUE');
      expect(error?.severity).toBe('error');
    });
  });

  describe('autoscroll', () => {
    it('accepts the Godot default', () => {
      expect(check('autoscroll', 'Vector2(0, 0)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('autoscroll', 'not-a-vector');
      expect(error?.code).toBe('INVALID_AUTOSCROLL_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a negative value — set_autoscroll (parallax_2d.cpp:204-211) assigns straight through', () => {
      expect(check('autoscroll', 'Vector2(-40, 0)')).toBeNull();
    });
  });

  describe('repeat_times', () => {
    it('accepts the Godot default', () => {
      // doc/classes/Parallax2D.xml: default="1".
      expect(check('repeat_times', '1')).toBeNull();
    });

    it('accepts a value above the floor', () => {
      expect(check('repeat_times', '4')).toBeNull();
    });

    it('warns that a non-integer value is truncated', () => {
      const error = check('repeat_times', '5.5');
      expect(error?.code).toBe('INVALID_REPEAT_TIMES_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('errors below the floor — set_repeat_times clamps up to 1 (parallax_2d.cpp:181)', () => {
      const error = check('repeat_times', '0');
      expect(error?.code).toBe('INVALID_REPEAT_TIMES_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative value the same way', () => {
      const error = check('repeat_times', '-3');
      expect(error?.code).toBe('INVALID_REPEAT_TIMES_VALUE');
      expect(error?.severity).toBe('error');
    });
  });

  describe('limit_begin', () => {
    it('accepts the Godot default', () => {
      // doc/classes/Parallax2D.xml: default="Vector2(-10000000, -10000000)".
      expect(check('limit_begin', 'Vector2(-10000000, -10000000)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('limit_begin', 'not-a-vector');
      expect(error?.code).toBe('INVALID_LIMIT_BEGIN_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a value above its paired limit_end — set_limit_begin (parallax_2d.cpp:233-235) assigns straight through and _update_scroll silently skips an inverted axis', () => {
      expect(check('limit_begin', 'Vector2(500, 500)')).toBeNull();
    });
  });

  describe('limit_end', () => {
    it('accepts the Godot default', () => {
      // doc/classes/Parallax2D.xml: default="Vector2(10000000, 10000000)".
      expect(check('limit_end', 'Vector2(10000000, 10000000)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('limit_end', 'not-a-vector');
      expect(error?.code).toBe('INVALID_LIMIT_END_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a value below its paired limit_begin — set_limit_end (parallax_2d.cpp:241-243) assigns straight through', () => {
      expect(check('limit_end', 'Vector2(-500, -500)')).toBeNull();
    });
  });

  describe('follow_viewport', () => {
    it('accepts the Godot default', () => {
      expect(check('follow_viewport', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('follow_viewport', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('follow_viewport', 'yes');
      expect(error?.code).toBe('INVALID_FOLLOW_VIEWPORT_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('ignore_camera_scroll', () => {
    it('accepts the Godot default', () => {
      expect(check('ignore_camera_scroll', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('ignore_camera_scroll', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('ignore_camera_scroll', 'yes');
      expect(error?.code).toBe('INVALID_IGNORE_CAMERA_SCROLL_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('screen_offset', () => {
    it('accepts the Godot default', () => {
      expect(check('screen_offset', 'Vector2(0, 0)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      const error = check('screen_offset', 'not-a-vector');
      expect(error?.code).toBe('INVALID_SCREEN_OFFSET_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('accepts a negative value — set_screen_offset (parallax_2d.cpp:219-225) assigns straight through', () => {
      expect(check('screen_offset', 'Vector2(-8, 0)')).toBeNull();
    });
  });
});
