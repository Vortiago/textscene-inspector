/**
 * `<Range>` — the native (WebGL canvas) painter for the base `Range` type.
 * `Range::_notification` (`range.cpp:108-128`) handles only
 * `NOTIFICATION_ACCESSIBILITY_UPDATE` — no `NOTIFICATION_DRAW` arm — and
 * `Range` overrides neither `get_minimum_size()` (unlike `Slider`, which
 * does) nor any container layout, so this base draws nothing and imposes no
 * layout. Registered anyway, so an authored Range gets a real (empty)
 * painter instead of `<ControlFallback>`'s debug outline, which Godot never
 * draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Range(_props: NativeControlComponentProps) {
  return null;
}
