/**
 * AnimatedSprite3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AnimatedSprite3D', property);
  expect(validator, `no validator registered for AnimatedSprite3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * AnimatedSprite3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'sprite_frames',
  'animation',
  'autoplay',
  'frame',
  'frame_progress',
  'speed_scale',
  // sprite_3d.cpp:1495, the pre-4.0 spelling of `sprite_frames`.
  'frames',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys AnimatedSprite3D does NOT declare, each paired with the ancestor that does.
 *
 * SpriteBase3D now has a real shared registration
 * (`../sprites/shared/linterParser.ts`), imported for its side effect below via
 * `./linterParser.js`, so its 20 members resolve here through the base-walk —
 * the same function `Sprite3D` resolves, not a per-leaf copy. `GeometryInstance3D`,
 * one hop further up, has its own registration too, so `cast_shadow` is also
 * checked.
 */
const INHERITED: [owner: string, key: string][] = [
  ['GeometryInstance3D', 'cast_shadow'],
  ['SpriteBase3D', 'centered'],
  ['SpriteBase3D', 'billboard'],
  ['SpriteBase3D', 'render_priority'],
];

describe('AnimatedSprite3D strict validators', () => {
  it('registers exactly what AnimatedSprite3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('AnimatedSprite3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-animated-sprite-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // AnimatedSprite3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('AnimatedSprite3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key AnimatedSprite3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // AnimatedSprite3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('AnimatedSprite3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('AnimatedSprite3D')).not.toContain(key);
    }
  });

  describe('sprite_frames', () => {
    it('accepts a SubResource reference', () => {
      expect(check('sprite_frames', 'SubResource("SpriteFrames_walk")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('sprite_frames', 'ExtResource("1_frames")')).toBeNull();
    });

    it('rejects a bare resource path', () => {
      expect(check('sprite_frames', 'res://frames.tres')).not.toBeNull();
    });
  });

  describe('animation', () => {
    it('accepts a StringName literal (what Godot actually writes)', () => {
      expect(check('animation', '&"walk"')).toBeNull();
    });

    it('accepts a plain quoted string too', () => {
      expect(check('animation', '"walk"')).toBeNull();
    });

    it('accepts the empty-string default', () => {
      expect(check('animation', '&""')).toBeNull();
    });

    it('rejects an unquoted identifier', () => {
      expect(check('animation', 'walk')).not.toBeNull();
    });
  });

  describe('autoplay', () => {
    it('accepts the plain string Godot writes (String getter/setter)', () => {
      expect(check('autoplay', '"idle"')).toBeNull();
    });

    it('accepts a StringName literal too', () => {
      expect(check('autoplay', '&"idle"')).toBeNull();
    });

    it('rejects an unquoted identifier', () => {
      expect(check('autoplay', 'idle')).not.toBeNull();
    });
  });

  describe('frame', () => {
    it('accepts 0', () => {
      expect(check('frame', '0')).toBeNull();
    });

    it('accepts a positive integer', () => {
      expect(check('frame', '5')).toBeNull();
    });

    it('rejects a negative integer (sprite_3d.cpp:1271 clamps it to 0)', () => {
      const error = check('frame', '-1');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('non-negative');
    });

    it('rejects a non-integer', () => {
      const error = check('frame', '1.5');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('integer');
    });
  });

  describe('frame_progress', () => {
    it('accepts a value inside the documented 0-1 range', () => {
      expect(check('frame_progress', '0.5')).toBeNull();
    });

    it('accepts a value outside the documented range (never clamped or hinted)', () => {
      expect(check('frame_progress', '5.0')).toBeNull();
      expect(check('frame_progress', '-3.0')).toBeNull();
    });

    it('accepts inf and nan (legal TSCN float literals, no finite guard here)', () => {
      expect(check('frame_progress', 'inf')).toBeNull();
      expect(check('frame_progress', 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('frame_progress', 'half')).not.toBeNull();
    });
  });

  describe('speed_scale', () => {
    it('accepts the default 1.0', () => {
      expect(check('speed_scale', '1.0')).toBeNull();
    });

    it('accepts 0 (a documented "paused" value, not an error)', () => {
      expect(check('speed_scale', '0')).toBeNull();
    });

    it('accepts a negative value (documented reverse playback)', () => {
      expect(check('speed_scale', '-2.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('speed_scale', 'fast')).not.toBeNull();
    });
  });

  describe('frames, the pre-4.0 spelling of sprite_frames', () => {
    it('takes the same references sprite_frames takes', () => {
      // sprite_3d.cpp:1495 hands `p_value` straight to set_sprite_frames, so
      // the slot accepts exactly the same literals.
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
