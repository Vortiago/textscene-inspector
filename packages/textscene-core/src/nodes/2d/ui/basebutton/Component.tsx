/**
 * `<BaseButton>` draws nothing: `BaseButton::_notification` (`base_button.cpp:108-184`) has no
 * `NOTIFICATION_DRAW` arm, and it overrides no minimum size or layout, so a descendant draws.
 * The empty painter replaces `<ControlFallback>`'s debug outline, which Godot never draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function BaseButton(_props: NativeControlComponentProps) {
  return null;
}
