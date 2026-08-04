/**
 * `<Control>` — the native (WebGL canvas) painter for a plain `Control`.
 * Godot's `Control` base class overrides no `_draw`, so it contributes no
 * chrome of its own: `ControlCanvasWalker` already positions this node's
 * group, composes its modulate into `Modulate2DContext` for descendants, and
 * applies the free-Control rotate/scale-about-pivot transform
 * (`Container::fit_child_in_rect`'s rule) around this painter's own output AND
 * its children (rendered as the walker's siblings, not this component's
 * `children`) — so a leaf painter with no chrome needs no code of its own to
 * participate in either. Registering this (rather than leaving `Control`
 * unregistered) matters anyway: an unregistered type falls back to
 * `<ControlFallback>`'s debug outline, which a real Control should never
 * show.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Control(_props: NativeControlComponentProps) {
  return null;
}
