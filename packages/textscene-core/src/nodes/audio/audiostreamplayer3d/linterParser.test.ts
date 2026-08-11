/**
 * AudioStreamPlayer3D strict validators — `playback_type`, not yet covered by
 * linter.test.ts.
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
