/** A StyleBox over `rect`, in the coordinates of the group that holds it. A box that paints nothing draws nothing. */
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import type { Rect2 } from '../../../godot/math/rect2';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';

interface PositionedStyleBoxProps {
  box: StyleBoxFlatData;
  rect: Rect2;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function PositionedStyleBox({ box, rect, tint, renderOrder }: PositionedStyleBoxProps) {
  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
      <StyleBoxQuad
        styleBox={box}
        color={tint.own}
        rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}
