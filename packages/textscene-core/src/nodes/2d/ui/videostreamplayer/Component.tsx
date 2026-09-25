/**
 * `<VideoStreamPlayer>`: the native (WebGL canvas) painter. `NOTIFICATION_DRAW`
 * (`scene/gui/video_stream_player.cpp:174-184`) returns on a null `texture`, and nothing here decodes
 * a `VideoStream` frame, so it draws nothing, as Godot does. It is registered so the node skips
 * `<ControlFallback>`'s debug outline. The walker owns visibility, children and transform.
 */

import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function VideoStreamPlayer(_props: NativeControlComponentProps) {
  return null;
}
