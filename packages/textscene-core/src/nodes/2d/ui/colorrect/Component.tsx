/**
 * The native (WebGL canvas) painter for ColorRect: one `<ControlQuad>` of the
 * solved rect, filled with `color`. The fill multiplies `tint.own` while both
 * are sRGB, so the one linear conversion runs on the product.
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
