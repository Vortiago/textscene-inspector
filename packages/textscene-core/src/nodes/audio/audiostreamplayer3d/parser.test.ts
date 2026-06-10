/**
 * AudioStreamPlayer3D parser tests.
 *
 * Covers defaults, every parsed property, enum clamps, and the
 * StringName / quoted-string `bus` variant.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseAudioStreamPlayer3D } from './parser';
import { AttenuationModel, DopplerTracking } from './types';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Audio', type: 'AudioStreamPlayer3D' },
};

describe('parseAudioStreamPlayer3D defaults', () => {
  it('applies Godot defaults when only the heading is supplied', () => {
    const props = parseAudioStreamPlayer3D(HEADING, {});
    expect(props.volume_db).toBe(0);
    expect(props.pitch_scale).toBe(1);
    expect(props.playing).toBe(false);
    expect(props.autoplay).toBe(false);
    expect(props.stream_paused).toBe(false);
    expect(props.attenuation_model).toBe(AttenuationModel.ATTENUATION_INVERSE_DISTANCE);
    expect(props.unit_size).toBe(10);
    expect(props.max_distance).toBe(0);
    expect(props.max_db).toBe(3);
    expect(props.attenuation_filter_cutoff_hz).toBe(5000);
    expect(props.attenuation_filter_db).toBe(-24);
    expect(props.doppler_tracking).toBe(DopplerTracking.DOPPLER_TRACKING_DISABLED);
    expect(props.panning_strength).toBe(1);
    expect(props.area_mask).toBe(1);
    expect(props.emission_angle_enabled).toBe(false);
    expect(props.emission_angle_degrees).toBe(45);
    expect(props.emission_angle_filter_attenuation_db).toBe(-12);
    expect(props.bus).toBe('Master');
    expect(props.max_polyphony).toBe(1);
    expect(props.stream).toBeUndefined();
  });
});

describe('parseAudioStreamPlayer3D properties', () => {
  it('preserves the stream resource reference verbatim', () => {
    const props = parseAudioStreamPlayer3D(HEADING, { stream: 'ExtResource("1_ogg")' });
    expect(props.stream).toBe('ExtResource("1_ogg")');
  });

  it('parses scalar fields as floats', () => {
    const props = parseAudioStreamPlayer3D(HEADING, {
      volume_db: '-6.5',
      pitch_scale: '0.9',
      unit_size: '15.5',
      max_distance: '30',
      panning_strength: '0.5',
    });
    expect(props.volume_db).toBe(-6.5);
    expect(props.pitch_scale).toBe(0.9);
    expect(props.unit_size).toBe(15.5);
    expect(props.max_distance).toBe(30);
    expect(props.panning_strength).toBe(0.5);
  });

  it('parses booleans (autoplay / playing / emission_angle_enabled)', () => {
    const props = parseAudioStreamPlayer3D(HEADING, {
      autoplay: 'true',
      playing: 'true',
      emission_angle_enabled: 'true',
    });
    expect(props.autoplay).toBe(true);
    expect(props.playing).toBe(true);
    expect(props.emission_angle_enabled).toBe(true);
  });

  it('parses attenuation_model enum (and rejects out-of-range)', () => {
    expect(parseAudioStreamPlayer3D(HEADING, { attenuation_model: '2' }).attenuation_model)
      .toBe(AttenuationModel.ATTENUATION_LOGARITHMIC);
    expect(parseAudioStreamPlayer3D(HEADING, { attenuation_model: '3' }).attenuation_model)
      .toBe(AttenuationModel.ATTENUATION_DISABLED);
    // Out of range → fallback to default.
    expect(parseAudioStreamPlayer3D(HEADING, { attenuation_model: '9' }).attenuation_model)
      .toBe(AttenuationModel.ATTENUATION_INVERSE_DISTANCE);
  });

  it('parses doppler_tracking enum', () => {
    expect(parseAudioStreamPlayer3D(HEADING, { doppler_tracking: '1' }).doppler_tracking)
      .toBe(DopplerTracking.DOPPLER_TRACKING_IDLE_STEP);
    expect(parseAudioStreamPlayer3D(HEADING, { doppler_tracking: '2' }).doppler_tracking)
      .toBe(DopplerTracking.DOPPLER_TRACKING_PHYSICS_STEP);
  });

  it('parses bus from plain string ("Music")', () => {
    expect(parseAudioStreamPlayer3D(HEADING, { bus: '"Music"' }).bus).toBe('Music');
  });

  it('parses bus from StringName format (&"SFX")', () => {
    expect(parseAudioStreamPlayer3D(HEADING, { bus: '&"SFX"' }).bus).toBe('SFX');
  });

  it('parses max_polyphony as integer', () => {
    expect(parseAudioStreamPlayer3D(HEADING, { max_polyphony: '4' }).max_polyphony).toBe(4);
  });

  it('inherits Node3D transform from base parser', () => {
    const props = parseAudioStreamPlayer3D(HEADING, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)',
    });
    expect(props.transform?.origin).toEqual({ x: 0, y: 2, z: 0 });
  });
});
