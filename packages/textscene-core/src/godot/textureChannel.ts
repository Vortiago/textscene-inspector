/** The texture channel a BaseMaterial3D map reads, and the mask its shader samples through. */

/**
 * `BaseMaterial3D::TextureChannel` (`scene/resources/material.h:309-314`), as the integers a
 * `.tscn` stores for each `*_texture_channel` property.
 */
export enum TextureChannel {
  TEXTURE_CHANNEL_RED = 0,
  TEXTURE_CHANNEL_GREEN = 1,
  TEXTURE_CHANNEL_BLUE = 2,
  TEXTURE_CHANNEL_ALPHA = 3,
  TEXTURE_CHANNEL_GRAYSCALE = 4,
}

/** The channels the setters accept: each opens with `ERR_FAIL_INDEX(p_channel, 5)` (`material.cpp:2984`). */
export const TEXTURE_CHANNELS: readonly TextureChannel[] = [
  TextureChannel.TEXTURE_CHANNEL_RED,
  TextureChannel.TEXTURE_CHANNEL_GREEN,
  TextureChannel.TEXTURE_CHANNEL_BLUE,
  TextureChannel.TEXTURE_CHANNEL_ALPHA,
  TextureChannel.TEXTURE_CHANNEL_GRAYSCALE,
];

/** The `vec4` a shader dots a map's sample with to read one channel. */
export type TextureChannelMask = readonly [number, number, number, number];

/** `_get_texture_mask` (`material.cpp:2951-2961`). */
const MASKS: Readonly<Record<TextureChannel, TextureChannelMask>> = {
  [TextureChannel.TEXTURE_CHANNEL_RED]: [1, 0, 0, 0],
  [TextureChannel.TEXTURE_CHANNEL_GREEN]: [0, 1, 0, 0],
  [TextureChannel.TEXTURE_CHANNEL_BLUE]: [0, 0, 1, 0],
  [TextureChannel.TEXTURE_CHANNEL_ALPHA]: [0, 0, 0, 1],
  [TextureChannel.TEXTURE_CHANNEL_GRAYSCALE]: [0.3333333, 0.3333333, 0.3333333, 0],
};

export function textureChannelMask(channel: TextureChannel): TextureChannelMask {
  return MASKS[channel];
}
