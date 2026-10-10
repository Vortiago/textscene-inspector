import { describe, expect, it } from 'vitest';
import { TextureChannel, textureChannelMask } from './textureChannel';

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
});
