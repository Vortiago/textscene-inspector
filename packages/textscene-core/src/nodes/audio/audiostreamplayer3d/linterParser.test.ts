/**
 * AudioStreamPlayer3D strict validators: `playback_type`, and the tiers of `emission_angle_degrees`
 * with why its floor sits below the hint's. Asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator. Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AudioStreamPlayer3D', property);
  expect(validator, `no validator registered for AudioStreamPlayer3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AudioStreamPlayer3D strict validators: playback_type', () => {
  it('accepts every value the 3-entry AudioServer::PlaybackType hint names (Default,Stream,Sample)', () => {
    for (const value of [0, 1, 2]) {
      expect(check('playback_type', String(value))).toBeNull();
    }
  });

  it('warns, not errors, past the hint (audio_stream_player_internal.cpp:337-339 is a bare assignment)', () => {
    const error = check('playback_type', '3');
    expect(error).not.toBeNull();
    expect(error!.severity).toBe('warning');
    expect(error!.message).toContain('0-2');
  });

  it('rejects a non-numeric value', () => {
    const error = check('playback_type', 'Stream');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('must be a number');
  });
});

describe('AudioStreamPlayer3D strict validators: emission_angle_degrees', () => {
  // Two tiers, because the setter and the hint disagree at the floor:
  // audio_stream_player_3d.cpp:687 ERR_FAIL_CONDs `p_angle < 0 || p_angle > 90`,
  // while the hint at :899 is "0.1,90,0.1,degrees". The `degrees` flag is a unit
  // label, not `radians_as_degrees`, so nothing is converted here.
  it("accepts the hint's own band", () => {
    expect(check('emission_angle_degrees', '0.1')).toBeNull();
    expect(check('emission_angle_degrees', '45')).toBeNull();
    expect(check('emission_angle_degrees', '90')).toBeNull();
  });

  it('warns through [0, 0.1), which the setter accepts and the hint excludes', () => {
    expect(check('emission_angle_degrees', '0')?.severity).toBe('warning');
    expect(check('emission_angle_degrees', '0.05')?.severity).toBe('warning');
  });

  it('errors below the setter floor, which sits under the hint', () => {
    const below = check('emission_angle_degrees', '-0.1');
    expect(below?.severity).toBe('error');
    expect(below?.message).toContain('at least 0');
  });

  it('errors above 90, where the setter and the hint agree', () => {
    expect(check('emission_angle_degrees', '90.1')?.severity).toBe('error');
  });
});

/**
 * `set_volume_db` opens with `ERR_FAIL_COND_MSG(Math::is_nan(p_volume), ...)`
 * (audio_stream_player_3d.cpp:553) and refuses nothing else. Measured on 4.6.3: writing NaN after
 * `volume_db = -12` leaves -12, while `inf` and `-inf` are stored unaltered, so the finite guard
 * would reject two values Godot keeps, and no range bound can catch NaN.
 */
describe('AudioStreamPlayer3D strict validators: volume_db', () => {
  it('errors on nan, which the setter refuses', () => {
    const error = check('volume_db', 'nan');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('must not be NaN');
  });

  it('warns on inf against the hint band rather than erroring', () => {
    for (const value of ['inf', '-inf', 'inf_neg']) {
      const error = check('volume_db', value);
      expect(error?.severity, value).toBe('warning');
      expect(error?.message, value).toContain('between -80 and 80');
    }
  });

  it('accepts an ordinary value inside the band', () => {
    expect(check('volume_db', '-12.0')).toBeNull();
  });
});
