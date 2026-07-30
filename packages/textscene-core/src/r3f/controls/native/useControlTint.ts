/**
 * Adapts a Control's `modulate`/`self_modulate` (`ControlColor`, the parsed
 * 0..1 channel shape `ControlProperties` carries) onto the existing 2D
 * CanvasItem tint chain: `multiplyModulate` + `useGodotLinearColor` via
 * `useCanvasItemTint`, the SAME hook Sprite2D/TileMap/every other CanvasItem
 * uses, so a Control composes with an ancestor's `Modulate2DContext` value
 * exactly like any other 2D node. Per that module's own rule, colors compose
 * in sRGB (the space Godot's `Color(...)` literals are written in) and
 * convert to the renderer's linear working space exactly ONCE, at the end of
 * the chain — this module does not re-derive that, only supplies the two
 * `ControlColor`s the chain multiplies.
 */
import { useMemo } from 'react';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import {
  Modulate2DContext,
  useCanvasItemTint,
  WHITE_MODULATE,
  type CanvasItemTint,
  type RGBA,
} from '../../canvasItemModulate';

// Re-exported so a Native painter's own <Modulate2DContext.Provider> (the
// "provide per Control so children inherit" half of this module's contract)
// shares the identical context every other CanvasItem provides into.
export { Modulate2DContext };

function toRGBA(c: ControlColor | undefined): RGBA {
  return c ? { r: c.r, g: c.g, b: c.b, a: c.a } : WHITE_MODULATE;
}

/**
 * Resolve a Control's own-pixel tint (for its Native painter's material) and
 * the inherited value its children should compose against. `modulate`/
 * `selfModulate` come straight off `ControlProperties` — absent means "no
 * tint", matching Godot's own opaque-white default.
 */
export function useControlTint(
  modulate: ControlColor | undefined,
  selfModulate: ControlColor | undefined
): CanvasItemTint {
  const props = useMemo(
    () => ({ modulate: toRGBA(modulate), self_modulate: toRGBA(selfModulate) }),
    [modulate, selfModulate]
  );
  return useCanvasItemTint(props);
}
