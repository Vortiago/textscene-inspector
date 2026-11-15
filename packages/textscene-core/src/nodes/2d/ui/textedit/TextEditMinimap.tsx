/**
 * The minimap a TextEdit or CodeEdit paints inside its own rect when `minimap_draw` holds: one
 * `<ControlQuad>` per rect `textEditMinimapRects` returns, tinted as a child item of the control, without its `self_modulate`.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate, useItemLinearColorOf } from '../../../../r3f/canvasItemModulate';
import type { Rgba } from '../../../../godot/math/math';
import { textEditMinimapRects } from './minimap';

type MinimapInput = Parameters<typeof textEditMinimapRects>[0];

interface TextEditMinimapProps {
  input: MinimapInput;
  /** `childTint.own`, the raw sRGB `modulate` of the control without its `self_modulate`. */
  tint: Rgba;
  renderOrder: number;
}

export function TextEditMinimap({ input, tint, renderOrder }: TextEditMinimapProps) {
  const toItemLinear = useItemLinearColorOf();
  const rects = useMemo(() => textEditMinimapRects(input), [input]);
  return (
    <>
      {rects.map(({ x, y, w, h, color }, index) => {
        const tinted = multiplyModulate(tint, color);
        return (
          <CanvasItemGroup key={index} position={[x, -y, 0]}>
            <ControlQuad
              width={w}
              height={h}
              color={toItemLinear(tinted)}
              opacity={tinted.a}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        );
      })}
    </>
  );
}
