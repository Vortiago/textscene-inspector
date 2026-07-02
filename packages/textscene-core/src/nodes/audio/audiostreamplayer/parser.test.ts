/**
 * AudioStreamPlayer parser tests.
 *
 * Covers defaults, every parsed property, and the StringName / quoted-string `bus` variant.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseAudioStreamPlayer } from './parser';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Audio', type: 'AudioStreamPlayer' },
};

describe('parseAudioStreamPlayer defaults', () => {
  it('applies Godot defaults when only the heading is supplied', () => {
    const props = parseAudioStreamPlayer(HEADING, {});
    expect(props.volume_db).toBe(0);
    expect(props.pitch_scale).toBe(1);
    expect(props.playing).toBe(false);
    expect(props.autoplay).toBe(false);
    expect(props.stream_paused).toBe(false);
    expect(props.bus).toBe('Master');
    expect(props.max_polyphony).toBe(1);
    expect(props.stream).toBeUndefined();
  });
});

describe('parseAudioStreamPlayer properties', () => {
  it('preserves the stream resource reference verbatim', () => {
    const props = parseAudioStreamPlayer(HEADING, { stream: 'ExtResource("1_ogg")' });
    expect(props.stream).toBe('ExtResource("1_ogg")');
  });

  it('parses scalar fields as floats', () => {
    const props = parseAudioStreamPlayer(HEADING, {
      volume_db: '-6.5',
      pitch_scale: '0.9',
    });
    expect(props.volume_db).toBe(-6.5);
    expect(props.pitch_scale).toBe(0.9);
  });

  it('parses booleans (autoplay / playing / stream_paused)', () => {
    const props = parseAudioStreamPlayer(HEADING, {
      autoplay: 'true',
      playing: 'true',
      stream_paused: 'true',
    });
    expect(props.autoplay).toBe(true);
    expect(props.playing).toBe(true);
    expect(props.stream_paused).toBe(true);
  });

  it('parses bus from plain string ("Music")', () => {
    expect(parseAudioStreamPlayer(HEADING, { bus: '"Music"' }).bus).toBe('Music');
  });

  it('parses bus from StringName format (&"SFX")', () => {
    expect(parseAudioStreamPlayer(HEADING, { bus: '&"SFX"' }).bus).toBe('SFX');
  });

  it('parses max_polyphony as integer', () => {
    expect(parseAudioStreamPlayer(HEADING, { max_polyphony: '4' }).max_polyphony).toBe(4);
  });

  it('inherits Node base (name, parent)', () => {
    const props = parseAudioStreamPlayer(
      { type: 'node', attributes: { name: 'MyAudio', type: 'AudioStreamPlayer', parent: 'ParentNode' } },
      {}
    );
    expect(props.name).toBe('MyAudio');
    expect(props.parent).toBe('ParentNode');
  });
});
