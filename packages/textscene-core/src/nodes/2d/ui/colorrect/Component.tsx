/**
 * `<ColorRect>` — the native (WebGL canvas) painter for ColorRect: one
 * `<ControlQuad>` sized to the solved rect, filled with the parsed `color`.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. The parsed fill `color` is multiplied into `tint.own`
 * while both are still sRGB, so the single sRGB→linear conversion happens once,
 * on the product.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { parseColor } from '../../../../utils/colorParser';
import type { ColorRectProperties } from './types';

export function ColorRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<ColorRectProperties>(solveNode);
  const fill = useMemo(() => parseColor(props.color), [props.color]);

  const filled = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const color = useGodotLinearColor(filled);

  return (
    <ControlQuad
      width={rect.w}
      height={rect.h}
      color={color}
      opacity={filled.a}
      renderOrder={renderOrder}
    />
  );
}
