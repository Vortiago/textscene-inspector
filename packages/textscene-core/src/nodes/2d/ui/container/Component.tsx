/**
 * The native painter for the base `Container`, which draws nothing. `Container`
 * has no `NOTIFICATION_SORT_CHILDREN` arm (`container.cpp`): only a script sorts its children
 * (`container.cpp:207-214`). The empty painter replaces the debug outline of
 * `<ControlFallback>`, which Godot never draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Container(_props: NativeControlComponentProps) {
  return null;
}
