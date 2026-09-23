/**
 * The native painter for a plain `Control`, which overrides no `_draw` and so
 * draws nothing. `ControlCanvasWalker` applies the position, modulate and pivot
 * transform. The empty painter replaces the debug outline of `<ControlFallback>`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Control(_props: NativeControlComponentProps) {
  return null;
}
