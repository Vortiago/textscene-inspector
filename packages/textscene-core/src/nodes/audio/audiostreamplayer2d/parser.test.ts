/**
 * AudioStreamPlayer2D parser tests.
 *
 * Covers defaults, every parsed property, enum clamps, and the StringName / quoted-string `bus` variant.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseAudioStreamPlayer2D } from './parser';
import { PlaybackType } from './types';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Audio', type: 'AudioStreamPlayer2D' },
};

describe('parseAudioStreamPlayer2D defaults', () => {
  it('applies Godot defaults when only the heading is supplied', () => {
    const props = parseAudioStreamPlayer2D(HEADING, {});
    expect(props.volume_db).toBe(0);
    expect(props.pitch_scale).toBe(1);
    expect(props.playing).toBe(false);
    expect(props.autoplay).toBe(false);
    expect(props.stream_paused).toBe(false);
    expect(props.bus).toBe('Master');
    expect(props.max_polyphony).toBe(1);
    expect(props.max_distance).toBe(2000);
    expect(props.attenuation).toBe(1);
    expect(props.panning_strength).toBe(1);
    expect(props.area_mask).toBe(1);
    expect(props.playback_type).toBe(PlaybackType.DEFAULT);
    expect(props.stream).toBeUndefined();
  });
});

describe('parseAudioStreamPlayer2D properties', () => {
  it('preserves the stream resource reference verbatim', () => {
    const props = parseAudioStreamPlayer2D(HEADING, { stream: 'ExtResource("1_ogg")' });
    expect(props.stream).toBe('ExtResource("1_ogg")');
  });

  it('parses scalar fields as floats', () => {
    const props = parseAudioStreamPlayer2D(HEADING, {
      volume_db: '-6.5',
      pitch_scale: '0.9',
      max_distance: '30',
      attenuation: '0.5',
      panning_strength: '0.75',
    });
    expect(props.volume_db).toBe(-6.5);
    expect(props.pitch_scale).toBe(0.9);
    expect(props.max_distance).toBe(30);
    expect(props.attenuation).toBe(0.5);
    expect(props.panning_strength).toBe(0.75);
  });

  it('parses booleans (autoplay / playing / stream_paused)', () => {
    const props = parseAudioStreamPlayer2D(HEADING, {
      autoplay: 'true',
      playing: 'true',
      stream_paused: 'true',
    });
    expect(props.autoplay).toBe(true);
    expect(props.playing).toBe(true);
    expect(props.stream_paused).toBe(true);
  });

  it('parses playback_type enum (and rejects out-of-range)', () => {
    // Godot AudioServer.PlaybackType: DEFAULT=0, STREAM=1, SAMPLE=2.
    expect(parseAudioStreamPlayer2D(HEADING, { playback_type: '1' }).playback_type)
      .toBe(PlaybackType.STREAM);
    expect(parseAudioStreamPlayer2D(HEADING, { playback_type: '2' }).playback_type)
      .toBe(PlaybackType.SAMPLE);
    // Out of range (incl. the MAX=3 sentinel) → fallback to default.
    expect(parseAudioStreamPlayer2D(HEADING, { playback_type: '3' }).playback_type)
      .toBe(PlaybackType.DEFAULT);
    expect(parseAudioStreamPlayer2D(HEADING, { playback_type: '9' }).playback_type)
      .toBe(PlaybackType.DEFAULT);
  });

  it('parses bus from plain string ("Music")', () => {
    expect(parseAudioStreamPlayer2D(HEADING, { bus: '"Music"' }).bus).toBe('Music');
  });

  it('parses bus from StringName format (&"SFX")', () => {
    expect(parseAudioStreamPlayer2D(HEADING, { bus: '&"SFX"' }).bus).toBe('SFX');
  });

  it('parses max_polyphony as integer', () => {
    expect(parseAudioStreamPlayer2D(HEADING, { max_polyphony: '4' }).max_polyphony).toBe(4);
  });

  it('inherits Node2D transform from base parser', () => {
    const props = parseAudioStreamPlayer2D(HEADING, {
      position: 'Vector2(100, 50)',
    });
    expect(props.position).toEqual({ x: 100, y: 50 });
    expect(props.rotation).toBe(0);
    expect(props.scale).toEqual({ x: 1, y: 1 });
  });
});
