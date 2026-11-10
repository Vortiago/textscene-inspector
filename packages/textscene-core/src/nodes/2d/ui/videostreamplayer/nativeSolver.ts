/**
 * VideoStreamPlayer's native (WebGL canvas) minimum-size solver: `get_minimum_size`
 * (`scene/gui/video_stream_player.cpp:232-238`) is `texture_size` when `!expand`, else `Size2()`.
 * `texture_size` is the stream's picture size (`:262-322`), which the solve reads from the file.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TscnNode } from '../../../../parser/types';
import type { MinimumSizeFn, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import type { VideoStreamPlayerProperties } from './types';

/** The key `videoStreamPlayerTextureSlots` and `videoStreamPlayerMinimumSize` share for `SolveNode.textureSlots`. */
const STREAM_KEY = 'stream';

/** The one slot `buildSolveTree.ts` sizes: the stream, whose picture size is the player's texture size. */
export const videoStreamPlayerTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const { stream } = node.properties as VideoStreamPlayerProperties;
  return stream ? [{ key: STREAM_KEY, ref: stream }] : [];
};

export const videoStreamPlayerMinimumSize: MinimumSizeFn = (n) => {
  const { expand } = n.node.properties as VideoStreamPlayerProperties;
  const pictureSize = n.textureSlots[STREAM_KEY];
  return expand || !pictureSize ? { x: 0, y: 0 } : pictureSize;
};
