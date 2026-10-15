import { describe, expect, it } from 'vitest';
import {
  TEXTURE_CHANNELS,
  TEXTURE_CHANNEL_NAMES,
  TextureChannel,
  textureChannelMask,
} from './textureChannel';

describe('TEXTURE_CHANNEL_NAMES', () => {
  it('names each channel by the integer a .tscn stores', () => {
    expect(TEXTURE_CHANNEL_NAMES[4]).toBe('TEXTURE_CHANNEL_GRAYSCALE');
  });
});

describe('textureChannelMask', () => {
  it('picks the one channel a colour channel names', () => {
    // `material.cpp:2953-2956`.
    expect(textureChannelMask(TextureChannel.TEXTURE_CHANNEL_BLUE)).toEqual([0, 0, 1, 0]);
  });

  it('averages the colour channels for GRAYSCALE, leaving alpha out', () => {
    // `material.cpp:2957`.
    expect(textureChannelMask(TextureChannel.TEXTURE_CHANNEL_GRAYSCALE)).toEqual([
      0.3333333, 0.3333333, 0.3333333, 0,
    ]);
  });

  it('gives every channel the setters accept a mask (edge case)', () => {
    expect(TEXTURE_CHANNELS.every((channel) => textureChannelMask(channel).length === 4)).toBe(true);
  });
});
