/**
 * AnimatedSprite2D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * The AnimatedSprite3D twin (`nodes/3d/animatedsprite3d/linterParser.test.ts`)
 * asserts the same verdicts for the six members the two classes share, because
 * Godot declares both from the same shape.
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
  // animated_sprite_2d.cpp:617, the pre-4.0 spelling of `sprite_frames`.
  'frames',
];

/**
 * Keys AnimatedSprite2D does NOT declare, each paired with the ancestor that does.
 *
 * Node2D is AnimatedSprite2D's base, and `../../base/node2d/linterParser.js` is
 * imported for its side effect through `./linterParser.js`, so these resolve to
 * the ancestor's own function rather than to a per-leaf copy.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
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
      // The SAME function, not merely some validator: a shadowing copy on
      // AnimatedSprite2D would answer here while drifting from the ancestor's rule.
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

  describe('frames, the pre-4.0 spelling of sprite_frames', () => {
    it('takes the same references sprite_frames takes', () => {
      // animated_sprite_2d.cpp:617 hands `p_value` straight to
      // set_sprite_frames, so the slot accepts exactly the same literals.
      expect(check('frames', 'SubResource("SpriteFrames_walk")')).toBeNull();
      expect(check('frames', 'ExtResource("1_frames")')).toBeNull();
      expect(check('frames', 'null')).toBeNull();
    });

    it('names the deprecated key, not the canonical one, when it rejects', () => {
      const error = check('frames', 'res://frames.tres');
      expect(error).not.toBeNull();
      expect(error!.message).toContain("'frames'");
      expect(error!.message).not.toContain('sprite_frames');
    });
  });
});

/**
 * `playing` is registered, and NOT as a boolean.
 *
 * It carried `v.boolean` while the slice's own rule said the type declares no
 * such property, so `playing = true` reported clean on a key `_setv` drops.
 * Nothing binds it: no ADD_PROPERTY (animated_sprite_2d.cpp:671-681), no
 * `<member>` in the class XML, and `is_playing` is a method binding
 * (animated_sprite_2d.cpp:634).
 *
 * Deleting the entry outright is what this pins against — with no validator the
 * key is silently accepted, which is worse than the boolean was.
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
