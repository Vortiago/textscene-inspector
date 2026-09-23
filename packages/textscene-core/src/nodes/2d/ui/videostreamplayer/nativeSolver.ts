/**
 * VideoStreamPlayer's native (WebGL canvas) minimum-size solver: `get_minimum_size`
 * (`scene/gui/video_stream_player.cpp:232-238`) is `texture_size` when `!expand && texture.is_valid()`,
 * else `Size2()`. Nothing here decodes a `VideoStream` frame, so it is always `Size2()`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';

export const videoStreamPlayerMinimumSize: MinimumSizeFn = () => ({ x: 0, y: 0 });
