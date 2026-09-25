/**
 * The native (WebGL canvas) painter for the base `Range` type. It draws
 * nothing: `Range::_notification` (`range.cpp:108-128`) has no
 * `NOTIFICATION_DRAW` arm. It exists so a Range gets no `<ControlFallback>`
 * debug outline, which Godot never draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Range(_props: NativeControlComponentProps) {
  return null;
}
