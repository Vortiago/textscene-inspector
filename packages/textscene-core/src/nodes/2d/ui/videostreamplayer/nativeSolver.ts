/**
 * VideoStreamPlayer's native (WebGL canvas) minimum-size solver —
 * `VideoStreamPlayer::get_minimum_size` (`scene/gui/video_stream_player.cpp:232-238`):
 * `texture_size` when `!expand && texture.is_valid()`, else `Size2()`. Nothing
 * in this codebase decodes a `VideoStream` frame, so `texture` is never valid
 * and this is unconditionally the `Size2()` branch, whatever `expand` is.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';

export const videoStreamPlayerMinimumSize: MinimumSizeFn = () => ({ x: 0, y: 0 });
