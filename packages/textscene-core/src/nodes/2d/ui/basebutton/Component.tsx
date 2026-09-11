/**
 * `<BaseButton>` — the native (WebGL canvas) painter for the base
 * `BaseButton` type. `BaseButton::_notification` (`base_button.cpp:108-184`)
 * handles accessibility/mouse/focus/visibility notifications only — no
 * `NOTIFICATION_DRAW` arm — a concrete descendant (`Button`, `CheckBox`, …)
 * is what draws. `BaseButton` overrides neither `get_minimum_size()` nor any
 * container layout either, so this base draws nothing and imposes no layout.
 * Its `disabled`/`toggle_mode`/`button_pressed`/… interaction state is real
 * (already parsed by `linterParser.ts`), but none of it has anywhere to
 * render without a descendant's own chrome. Registered anyway, so an
 * authored BaseButton gets a real (empty) painter instead of
 * `<ControlFallback>`'s debug outline, which Godot never draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function BaseButton(_props: NativeControlComponentProps) {
  return null;
}
