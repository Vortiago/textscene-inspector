/**
 * AudioStreamPlayer3D strict validators — `playback_type`, not covered by
 * linter.test.ts, and `emission_angle_degrees`, whose value table there pins the
 * band by value without stating the tier or why the floor sits below the hint's.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. Rule-level behaviour belongs in linter.test.ts.
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
  // audio_stream_player_3d.cpp:687, ERR_FAIL_COND(p_angle < 0 || p_angle > 90) —
  // the setter's band, wider at the floor than the "0.1,90,0.1,degrees" hint at :899.
  it("accepts the setter's own ends, 0 and 90, not the hint's narrower 0.1 floor", () => {
    expect(check('emission_angle_degrees', '0')).toBeNull();
    expect(check('emission_angle_degrees', '90')).toBeNull();
  });

  it('stays silent through [0, 0.1), a hint-only sliver the setter accepts', () => {
    expect(check('emission_angle_degrees', '0.05')).toBeNull();
  });

  it('errors one step past each enforced end', () => {
    expect(check('emission_angle_degrees', '-0.1')?.severity).toBe('error');
    expect(check('emission_angle_degrees', '90.1')?.severity).toBe('error');
  });
});
