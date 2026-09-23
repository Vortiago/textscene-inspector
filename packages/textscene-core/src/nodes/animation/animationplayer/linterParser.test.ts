/**
 * AnimationPlayer strict validators for the "Playback Options" ADD_PROPERTY group
 * (animation_player.cpp:1042-1049). Asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator. Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AnimationPlayer', property);
  expect(validator, `no validator registered for AnimationPlayer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AnimationPlayer strict validators: Playback Options group', () => {
  describe('movie_quit_on_finish', () => {
    it('accepts true and false (animation_player.cpp:782-784, bare assignment)', () => {
      expect(check('movie_quit_on_finish', 'true')).toBeNull();
      expect(check('movie_quit_on_finish', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('movie_quit_on_finish', 'yes');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('movie_quit_on_finish');
      expect(error!.message).toContain('boolean');
    });
  });

  describe('playback_auto_capture', () => {
    it('accepts true and false (animation_player.cpp:857-858, bare assignment)', () => {
      expect(check('playback_auto_capture', 'true')).toBeNull();
      expect(check('playback_auto_capture', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('playback_auto_capture', '1');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('playback_auto_capture');
      expect(error!.message).toContain('converts');
    });
  });

  describe('playback_auto_capture_duration', () => {
    it('accepts any float, positive or negative (no hint bound, only "suffix:s")', () => {
      // -1.0 is the engine's own default (animation_player.h:61), a sentinel
      // meaning "use the animation's own length", not an error value.
      expect(check('playback_auto_capture_duration', '-1.0')).toBeNull();
      expect(check('playback_auto_capture_duration', '0.0')).toBeNull();
      expect(check('playback_auto_capture_duration', '2.5')).toBeNull();
      expect(check('playback_auto_capture_duration', '100')).toBeNull();
    });

    it('accepts inf/-inf/inf_neg/nan (legal TSCN float literals, no finite guard)', () => {
      for (const literal of ['inf', '-inf', 'inf_neg', 'nan']) {
        expect(check('playback_auto_capture_duration', literal)).toBeNull();
      }
    });

    it('rejects a non-numeric value', () => {
      const error = check('playback_auto_capture_duration', 'long');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('playback_auto_capture_duration');
      expect(error!.message).toContain('must be a number');
    });
  });

  describe('playback_auto_capture_transition_type', () => {
    it('accepts every value the 12-entry Tween::TransitionType hint names', () => {
      for (let value = 0; value <= 11; value++) {
        expect(check('playback_auto_capture_transition_type', String(value))).toBeNull();
      }
    });

    it('warns, not errors, past the hint (animation_player.cpp:1044 is hinted, not enforced)', () => {
      const error = check('playback_auto_capture_transition_type', '12');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
      expect(error!.message).toContain('0-11');
    });

    it('rejects a non-numeric value', () => {
      const error = check('playback_auto_capture_transition_type', 'Linear');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('must be a number');
    });
  });

  describe('playback_auto_capture_ease_type', () => {
    it('accepts every value the 4-entry Tween::EaseType hint names', () => {
      for (let value = 0; value <= 3; value++) {
        expect(check('playback_auto_capture_ease_type', String(value))).toBeNull();
      }
    });

    it('warns, not errors, past the hint (animation_player.cpp:1045 is hinted, not enforced)', () => {
      const error = check('playback_auto_capture_ease_type', '4');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
      expect(error!.message).toContain('0-3');
    });

    it('rejects a non-numeric value', () => {
      const error = check('playback_auto_capture_ease_type', 'In');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('must be a number');
    });
  });

  describe('playback_default_blend_time', () => {
    it('accepts both ends of the hint (animation_player.cpp:1046, "0,4096,0.01")', () => {
      expect(check('playback_default_blend_time', '0')).toBeNull();
      expect(check('playback_default_blend_time', '4096')).toBeNull();
    });

    it('warns, not errors, below 0 (animation_player.cpp:823 is a bare assignment)', () => {
      const error = check('playback_default_blend_time', '-0.01');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
      expect(error!.message).toContain('between 0 and 4096');
    });

    it('warns, not errors, above 4096', () => {
      const error = check('playback_default_blend_time', '4096.01');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
      expect(error!.message).toContain('between 0 and 4096');
    });

    it('rejects a non-numeric value', () => {
      const error = check('playback_default_blend_time', 'instant');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('must be a number');
    });
  });
});
