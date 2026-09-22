/**
 * `<VideoStreamPlayer>` — the native (WebGL canvas) painter for
 * VideoStreamPlayer. `_notification`'s `NOTIFICATION_DRAW`
 * (`scene/gui/video_stream_player.cpp:174-184`) returns immediately whenever
 * `texture` is null, before ever reaching `expand`/`stream`. Nothing in this
 * codebase decodes a `VideoStream` frame, so that texture is never assigned —
 * Godot itself draws nothing in that state, on every frame, so this painter
 * draws nothing too.
 *
 * Registered (rather than left unregistered) so this node stops falling
 * through to `<ControlFallback>`'s debug outline, which Godot never draws.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function VideoStreamPlayer(_props: NativeControlComponentProps) {
  return null;
}
