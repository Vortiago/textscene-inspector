/**
 * AnimationMixer strict validators: format checks for the three hand-rolled
 * `_set`/`_get` keys (`anims/<name>`, `libraries`, `libraries/<name>`), tested
 * through the abstract 'AnimationMixer' registry key AND through its two
 * concrete descendants.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(nodeType: string, property: string, value: string) {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator resolved for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AnimationMixer strict validators', () => {
  it('owns both the property-list families and AnimationMixer\'s ordinary members', () => {
    // The three `*`-patterned keys arrive through the property-list route that
    // no ADD_PROPERTY sweep can see; the other ten are ordinary ADD_PROPERTY
    // members (animation_mixer.cpp:2458-2473), registered HERE rather than on
    // AnimationPlayer and AnimationTree separately so the base-walk gives both
    // the same set — AnimationPlayer previously validated only `root_node` of
    // the ten.
    expect(validatorRegistry.getOwnKeys('AnimationMixer').sort()).toEqual(
      [
        'active',
        'anims/*',
        'audio_max_polyphony',
        'callback_mode_discrete',
        'callback_mode_method',
        'callback_mode_process',
        'deterministic',
        'libraries',
        'libraries/*',
        'reset_on_save',
        'root_motion_local',
        'root_motion_track',
        'root_node',
      ].sort()
    );
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('AnimationMixer')
      .filter((property) => check('AnimationMixer', property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('accepts every value the AnimationPlayer fixture carries (only single-line properties reach this)', () => {
    // `unit-animation-player.tscn` carries `libraries/ = SubResource(...)` on
    // one line. `unit-animation-player-libraries.tscn` carries the dict form
    // multi-line, which StrictTscnParser skips before any validator sees it —
    // this fixture is the one that actually exercises the live code path.
    expectFixtureClean('unit-animation-player.tscn');
  });

  describe('anims/<name>', () => {
    it('accepts a SubResource reference', () => {
      expect(check('AnimationMixer', 'anims/Walk', 'SubResource("Animation_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('AnimationMixer', 'anims/Walk', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a non-resource value', () => {
      expect(check('AnimationMixer', 'anims/Walk', '"res://anim.tres"')).not.toBeNull();
    });
  });

  describe('libraries (bare, legacy dict-form compat key)', () => {
    it('accepts the empty Dictionary', () => {
      expect(check('AnimationMixer', 'libraries', '{}')).toBeNull();
    });

    it('accepts a Dictionary literal mapping names to library references', () => {
      expect(
        check('AnimationMixer', 'libraries', '{\n"": SubResource("AnimationLibrary_default")\n}')
      ).toBeNull();
    });

    it('rejects a value that is not a Dictionary literal at all', () => {
      expect(check('AnimationMixer', 'libraries', 'SubResource("AnimationLibrary_1")')?.code).toBe(
        'INVALID_LIBRARIES_FORMAT'
      );
    });
  });

  describe('libraries/<name>', () => {
    it('accepts a SubResource reference for the default (empty-named) library', () => {
      expect(check('AnimationMixer', 'libraries/', 'SubResource("AnimationLibrary_default")')).toBeNull();
    });

    it('accepts a SubResource reference for a named library', () => {
      expect(check('AnimationMixer', 'libraries/combat', 'SubResource("AnimationLibrary_combat")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('AnimationMixer', 'libraries/', 'ExtResource("1_lib")')).toBeNull();
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      expect(check('AnimationMixer', 'libraries/', 'null')).toBeNull();
    });

    it('rejects a non-resource value', () => {
      expect(check('AnimationMixer', 'libraries/', '"res://lib.tres"')).not.toBeNull();
    });
  });

  describe('audio_max_polyphony: ERR_FAIL_COND(p < 0 || p > 128), animation_mixer.cpp:542', () => {
    it('accepts the hint band 1..127 silently', () => {
      expect(check('AnimationMixer', 'audio_max_polyphony', '1')).toBeNull();
      expect(check('AnimationMixer', 'audio_max_polyphony', '127')).toBeNull();
    });

    it("warns on the band the setter allows and the hint at :2468 does not, 0 and 128", () => {
      expect(check('AnimationMixer', 'audio_max_polyphony', '0')?.severity).toBe('warning');
      expect(check('AnimationMixer', 'audio_max_polyphony', '128')?.severity).toBe('warning');
    });

    it('errors one past each end: -1 and 129', () => {
      expect(check('AnimationMixer', 'audio_max_polyphony', '-1')?.severity).toBe('error');
      expect(check('AnimationMixer', 'audio_max_polyphony', '129')?.severity).toBe('error');
    });
  });

  describe('callback-mode enums: hinted only, every setter bare-assigns', () => {
    it('accepts callback_mode_process 0 (Physics) and 2 (Manual); warns at -1 and 3', () => {
      // animation_mixer.cpp:2471 hints "Physics,Idle,Manual";
      // set_callback_mode_process (:501) has no ERR_FAIL_INDEX.
      expect(check('AnimationMixer', 'callback_mode_process', '0')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_process', '2')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_process', '-1')?.severity).toBe('warning');
      expect(check('AnimationMixer', 'callback_mode_process', '3')?.severity).toBe('warning');
    });

    it('accepts callback_mode_method 0 (Deferred) and 1 (Immediate); warns at -1 and 2', () => {
      // animation_mixer.cpp:2472 hints two labels only;
      // set_callback_mode_method (:522) is a one-line assign.
      expect(check('AnimationMixer', 'callback_mode_method', '0')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_method', '1')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_method', '-1')?.severity).toBe('warning');
      expect(check('AnimationMixer', 'callback_mode_method', '2')?.severity).toBe('warning');
    });

    it('accepts callback_mode_discrete 0 (Dominant) and 2 (Force Continuous); warns at -1 and 3', () => {
      // animation_mixer.cpp:2473 hints "Dominant,Recessive,Force Continuous";
      // set_callback_mode_discrete (:531) assigns then clears caches.
      expect(check('AnimationMixer', 'callback_mode_discrete', '0')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_discrete', '2')).toBeNull();
      expect(check('AnimationMixer', 'callback_mode_discrete', '-1')?.severity).toBe('warning');
      expect(check('AnimationMixer', 'callback_mode_discrete', '3')?.severity).toBe('warning');
    });
  });

  describe('reaches AnimationPlayer and AnimationTree through the base-walk', () => {
    it.each(['AnimationPlayer', 'AnimationTree'])('%s resolves all three AnimationMixer keys', (nodeType) => {
      expect(check(nodeType, 'anims/Walk', 'SubResource("Animation_1")')).toBeNull();
      expect(check(nodeType, 'libraries', '{}')).toBeNull();
      expect(check(nodeType, 'libraries/', 'SubResource("AnimationLibrary_default")')).toBeNull();
    });
  });
});
