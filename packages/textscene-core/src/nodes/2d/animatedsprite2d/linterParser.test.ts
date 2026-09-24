/**
 * AnimatedSprite2D strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * The AnimatedSprite3D twin asserts the same verdicts for the members both classes
 * share. Rule behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AnimatedSprite2D', property);
  expect(validator, `no validator registered for AnimatedSprite2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key registered on AnimatedSprite2D, grouped by how it reaches a `.tscn`.
 * Read from the source, not from expectation.
 */
const KEYS: string[] = [
  // animated_sprite_2d.cpp:671-676 and :678-681, every ADD_PROPERTY.
  'sprite_frames',
  'animation',
  'autoplay',
  'frame',
  'frame_progress',
  'speed_scale',
  'centered',
  'offset',
  'flip_h',
  'flip_v',
];

/**
 * Keys AnimatedSprite2D does not declare, each paired with the ancestor that does.
 * `./linterParser.js` imports the Node2D slice for its side effect, so these
 * resolve to the ancestor's own function, not a per-leaf copy.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'transform'],
];

describe('AnimatedSprite2D strict validators', () => {
  it('registers exactly the keys listed above', () => {
    expect(validatorRegistry.getOwnKeys('AnimatedSprite2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-animatedsprite2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('AnimatedSprite2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // AnimatedSprite2D would answer here and could disagree with the ancestor.
      expect(validatorRegistry.findValidator('AnimatedSprite2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('AnimatedSprite2D')).not.toContain(key);
    }
  });

  describe('animation', () => {
    it('accepts the StringName literal Godot writes', () => {
      // animated_sprite_2d.cpp:672 declares Variant::STRING_NAME and
      // `StringName get_animation()` (animated_sprite_2d.h:101) serialises it.
      expect(check('animation', '&"walk"')).toBeNull();
    });

    it('accepts a plain quoted string too', () => {
      expect(check('animation', '"walk"')).toBeNull();
    });

    it('rejects an unquoted identifier', () => {
      expect(check('animation', 'walk')).not.toBeNull();
    });
  });

  describe('autoplay', () => {
    it('accepts the plain string Godot writes', () => {
      // animated_sprite_2d.cpp:673 declares Variant::STRING_NAME, but
      // `String get_autoplay()` (animated_sprite_2d.h:104) is what serialises.
      expect(check('autoplay', '"idle"')).toBeNull();
    });

    it('accepts a StringName literal too', () => {
      expect(check('autoplay', '&"idle"')).toBeNull();
    });

    it('rejects an unquoted identifier', () => {
      expect(check('autoplay', 'idle')).not.toBeNull();
    });
  });
});

/**
 * `playing` is registered as unavailable: no ADD_PROPERTY binds it
 * (animated_sprite_2d.cpp:671-681), and the deprecated-key `_set` handles only
 * `frames` (:615-622), so `_setv` drops the write. `is_playing` is a method
 * binding (:634). With no entry at all, the key would be silently accepted.
 */
describe('playing is a key verdict, not a value', () => {
  it('rejects the key whatever the value', () => {
    for (const value of ['true', 'false', '1']) {
      const verdict = validatorRegistry.findValidator('AnimatedSprite2D', 'playing')?.(
        'playing',
        value,
        1
      );
      expect(verdict?.severity).toBe('error');
      expect(verdict?.message).toContain('cannot be set on AnimatedSprite2D');
    }
  });
});
