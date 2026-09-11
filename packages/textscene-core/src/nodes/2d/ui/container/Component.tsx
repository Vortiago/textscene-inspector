/**
 * `<Container>` — the native (WebGL canvas) painter for the base `Container`
 * type. `Container::_notification` (`container.cpp`) has no
 * `NOTIFICATION_SORT_CHILDREN` arm of its own — only a script attached to a
 * bare Container implements one (`container.cpp:207-214`'s own configuration
 * warning says as much) — so this base draws no chrome and imposes no layout;
 * its children solve as free/anchored Controls against its own rect, exactly
 * as an unregistered type's children already do (`native/solverRegistry.ts`'s
 * own doc). Registered anyway, so an authored Container gets a real (empty)
 * painter instead of `<ControlFallback>`'s debug outline, which Godot never
 * draws.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Container(_props: NativeControlComponentProps) {
  return null;
}
