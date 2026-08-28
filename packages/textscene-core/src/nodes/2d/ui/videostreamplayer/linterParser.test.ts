/**
 * VideoStreamPlayer strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VideoStreamPlayer', property);
  expect(validator, `no validator registered for VideoStreamPlayer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * VideoStreamPlayer binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'audio_track',
  'autoplay',
  'buffering_msec',
  'bus',
  'expand',
  'loop',
  'paused',
  'speed_scale',
  'stream',
  'volume_db',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('VideoStreamPlayer strict validators', () => {
  it('registers exactly what VideoStreamPlayer binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('VideoStreamPlayer').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-video-stream-player.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('VideoStreamPlayer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('audio_track', () => {
    it('accepts a track index anywhere inside the hinted 0-128 span', () => {
      expect(check('audio_track', '0')).toBeNull();
      expect(check('audio_track', '3')).toBeNull();
      expect(check('audio_track', '128')).toBeNull();
    });

    it('rejects a track index that is not a number', () => {
      const error = check('audio_track', 'first');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('audio_track');
    });

    it('only warns outside the span, because set_audio_track assigns straight through', () => {
      // video_stream_player.cpp:399, `audio_track = p_track;`, no clamp, so the
      // "0,128,1" hint at video_stream_player.cpp:573 binds the inspector only.
      expect(check('audio_track', '-1')?.severity).toBe('warning');
      expect(check('audio_track', '129')?.severity).toBe('warning');
    });
  });

  describe('buffering_msec', () => {
    it('accepts a buffer size anywhere inside the hinted 10-1000 span', () => {
      expect(check('buffering_msec', '10')).toBeNull();
      expect(check('buffering_msec', '500')).toBeNull();
      expect(check('buffering_msec', '1000')).toBeNull();
    });

    it('rejects a buffer size that is not a number', () => {
      const error = check('buffering_msec', 'half a second');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('buffering_msec');
    });

    it('only warns outside the span, because set_buffering_msec assigns straight through', () => {
      // video_stream_player.cpp:391, `buffering_ms = p_msec;`. The value reaches
      // AudioRBResampler::setup, which rounds a ring-buffer SIZE from it without
      // touching the stored property, so nothing enforces the hint's ends.
      expect(check('buffering_msec', '0')?.severity).toBe('warning');
      expect(check('buffering_msec', '5000')?.severity).toBe('warning');
    });
  });

  describe('speed_scale', () => {
    it('accepts normal, halved and stopped playback', () => {
      expect(check('speed_scale', '1.0')).toBeNull();
      expect(check('speed_scale', '0.5')).toBeNull();
      // 0.0 pauses the video rather than being refused, so it is a legal value.
      expect(check('speed_scale', '0.0')).toBeNull();
    });

    it('stays silent above the hint, whose max end is open', () => {
      // "0,4,0.001,or_greater" at video_stream_player.cpp:577: `,or_greater`
      // opens the max end, so a faster-than-4x scale draws nothing at all.
      expect(check('speed_scale', '4.0')).toBeNull();
      expect(check('speed_scale', '25.0')).toBeNull();
    });

    it('rejects a speed that is not a number', () => {
      const error = check('speed_scale', 'double');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('speed_scale');
    });

    it('errors below zero, which the setter refuses outright', () => {
      // video_stream_player.cpp:437, `ERR_FAIL_COND(p_speed_scale < 0.0);`
      const error = check('speed_scale', '-0.5');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('non-negative');
    });
  });

  describe('volume_db', () => {
    it('accepts the dB span the inspector offers, silence included', () => {
      expect(check('volume_db', '0.0')).toBeNull();
      expect(check('volume_db', '-12.5')).toBeNull();
      expect(check('volume_db', '24.0')).toBeNull();
      // -80 is the value Godot itself writes for silence: set_volume_db takes the
      // `p_db < -79` branch and get_volume_db reports -80 back, so it round-trips.
      expect(check('volume_db', '-80.0')).toBeNull();
    });

    it('rejects a volume that is not a number', () => {
      const error = check('volume_db', 'loud');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('volume_db');
    });

    it('errors below -80, where the setter collapses the value to silence', () => {
      // video_stream_player.cpp:421-422, `if (p_db < -79) { set_volume(0); }`, and
      // get_volume_db then returns -80 (video_stream_player.cpp:429-430), so a
      // quieter value is not the value that survives the load.
      expect(check('volume_db', '-96.0')?.severity).toBe('error');
    });

    it('only warns above 24, where the setter converts straight through', () => {
      // The else branch, video_stream_player.cpp:424, stores db_to_linear(p_db)
      // with no ceiling, so "-80,24,0.01,suffix:dB" at video_stream_player.cpp:575
      // binds the inspector slider only.
      expect(check('volume_db', '40.0')?.severity).toBe('warning');
    });
  });

  describe('the four playback flags', () => {
    // autoplay (cpp:578), paused (cpp:579), expand (cpp:580) and loop (cpp:581)
    // are plain Variant::BOOL binds with PROPERTY_HINT_NONE, so the only thing
    // there is to check is the literal.
    const FLAGS = ['autoplay', 'paused', 'expand', 'loop'];

    it('accepts both boolean literals on every flag', () => {
      for (const flag of FLAGS) {
        expect(check(flag, 'true'), flag).toBeNull();
        expect(check(flag, 'false'), flag).toBeNull();
      }
    });

    it('rejects a non-boolean literal on every flag', () => {
      for (const flag of FLAGS) {
        const error = check(flag, '1');
        expect(error?.severity, flag).toBe('warning');
        expect(error?.message, flag).toContain(flag);
      }
    });

    it('rejects a capitalised literal, which the TSCN grammar does not read', () => {
      expect(check('expand', 'True')?.severity).toBe('error');
    });
  });

  describe('bus', () => {
    it('accepts the StringName literal Godot saves and the plain quoted form', () => {
      expect(check('bus', '&"Master"')).toBeNull();
      expect(check('bus', '&"SFX"')).toBeNull();
      expect(check('bus', '"Music"')).toBeNull();
    });

    it('rejects an unquoted bus name', () => {
      const error = check('bus', 'Master');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('bus');
    });

    it('does not judge which bus names exist, because the scene cannot know', () => {
      // The PROPERTY_HINT_ENUM at video_stream_player.cpp:585 ships with an EMPTY
      // hint string; _validate_property fills it from the live AudioServer at
      // video_stream_player.cpp:510-521, and only in the editor. The bus layout
      // lives outside the scene, so an unknown name is not a scene-level defect.
      expect(check('bus', '&"NotABusInAnyProject"')).toBeNull();
    });
  });

  describe('stream', () => {
    it('accepts either resource reference form', () => {
      // A .ogv arrives as an ExtResource; a VideoStreamTheora written inline in
      // the scene arrives as a SubResource.
      expect(check('stream', 'ExtResource("1_video")')).toBeNull();
      expect(check('stream', 'SubResource("VideoStreamTheora_intro")')).toBeNull();
    });

    it('rejects a bare path where a reference belongs', () => {
      const error = check('stream', '"res://video/intro.ogv"');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('stream');
    });

    it('rejects a truncated reference', () => {
      expect(check('stream', 'ExtResource(')?.severity).toBe('error');
    });
  });

  describe('the two binds that never reach a .tscn', () => {
    // Both are real ADD_PROPERTY calls, and both pass PROPERTY_USAGE_NONE:
    // `volume` (video_stream_player.cpp:576) is the linear twin of volume_db, and
    // `stream_position` (video_stream_player.cpp:583) is a seek that only means
    // anything against a live playback. Godot serialises neither, so a validator
    // for either would guard a key that cannot appear. The registration test above
    // pins the set; this says why these two are outside it.
    it.each(['volume', 'stream_position'])('registers no validator for %s', (property) => {
      expect(validatorRegistry.findValidator('VideoStreamPlayer', property)).toBeNull();
    });
  });
});
