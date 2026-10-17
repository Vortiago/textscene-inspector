import { describe, expect, it } from 'vitest';
import {
  AUDIO_STREAM_PLAYER_3D_ATTENUATION_MODEL_NAMES,
  AUDIO_STREAM_PLAYER_MIX_TARGET_NAMES,
  DOPPLER_TRACKING_NAMES,
} from './audio.js';

describe('audio enum label tables', () => {
  it('names the AudioStreamPlayer mix targets without their MIX_TARGET_ prefix (audio_stream_player.h:45-49)', () => {
    expect(AUDIO_STREAM_PLAYER_MIX_TARGET_NAMES).toEqual({ 0: 'STEREO', 1: 'SURROUND', 2: 'CENTER' });
  });

  it('names the AudioStreamPlayer3D attenuation models without their ATTENUATION_ prefix (audio_stream_player_3d.h:49-54)', () => {
    expect(AUDIO_STREAM_PLAYER_3D_ATTENUATION_MODEL_NAMES).toEqual({
      0: 'INVERSE_DISTANCE',
      1: 'INVERSE_SQUARE_DISTANCE',
      2: 'LOGARITHMIC',
      3: 'DISABLED',
    });
  });

  it('names the doppler tracking modes the player, listener and camera share', () => {
    expect(DOPPLER_TRACKING_NAMES).toEqual({ 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' });
  });
});
