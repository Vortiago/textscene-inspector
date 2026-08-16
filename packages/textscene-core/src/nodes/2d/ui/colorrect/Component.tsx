/**
 * `<ColorRect>` — the native (WebGL canvas) painter for ColorRect: one
 * `<ControlQuad>` sized to the solved rect, filled with the parsed `color`.
 *
 * Tint: `useControlOwnTint` — `self_modulate` only; the walker owns
 * `modulate`. The parsed fill `color` is the `ownMultiplier` — the parameter
 * `canvasItemModulate.ts` documents for "a further tint before the single
 * sRGB→linear conversion".
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlOwnTint } from '../../../../r3f/controls/native/controlTint';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { parseColor } from '../../../../utils/colorParser';
import type { ColorRectProperties } from './types';

export function ColorRect({ solveNode, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<ColorRectProperties>(solveNode);
  const fill = useMemo(() => parseColor(props.color), [props.color]);

  const tint = useControlOwnTint(solveNode, fill);

  return (
    <ControlQuad
      width={rect.w}
      height={rect.h}
      color={tint.color}
      opacity={tint.opacity}
      renderOrder={renderOrder}
    />
  );
}
