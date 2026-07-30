/**
 * `<ColorRectNative>` — the native (WebGL canvas) painter for ColorRect: one
 * `<ControlQuad>` sized to the solved rect, filled with the parsed `color`.
 *
 * `ControlCanvasWalker` already composes this node's OWN `modulate` into the
 * `Modulate2DContext` value it provides around this painter (`tint.inherited`
 * = ancestor tint × this node's `modulate`), so `useParentModulate()` here
 * already carries that product — reusing `useControlTint` would multiply
 * `modulate` in a SECOND time. What the walker does NOT (and must not) do is
 * apply `self_modulate`, which only ever tints a node's OWN pixels
 * (class_canvasitem.html) and must never reach `Modulate2DContext` for
 * children to inherit. This painter therefore calls `useCanvasItemTint`
 * directly: `modulate: WHITE_MODULATE` (already folded into the ambient
 * context, so passing it again would double it), `self_modulate` from this
 * node's own properties, and the parsed fill `color` as `ownMultiplier` — the
 * same parameter `canvasItemModulate.ts` documents for "a further tint before
 * the single sRGB→linear conversion". One conversion, composed in sRGB,
 * exactly as that module requires.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { parseColor } from '../../../../utils/colorParser';
import type { ColorRectProperties } from './types';

export function ColorRectNative({ solveNode, rect }: NativeControlComponentProps) {
  const props = solveNode.node.properties as ColorRectProperties;
  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const fill = useMemo(() => parseColor(props.color), [props.color]);

  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate }, fill);

  return <ControlQuad width={rect.w} height={rect.h} color={tint.color} opacity={tint.opacity} />;
}
