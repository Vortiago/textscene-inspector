/**
 * An icon-only Button: its box, then the icon centred inside that box's margins
 * (`color_picker.cpp:2085,2101,2153`, `button.cpp:349-405`). A box that paints nothing draws nothing.
 */

import type * as THREE from 'three';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import { multiplyModulate, type useItemLinearColorOf } from '../../canvasItemModulate';
import { PositionedIcon } from './PositionedIcon';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { iconOnlyButtonIconRectIn } from './buttonBase';
import { HorizontalAlignment } from '../../../godot/math/alignment';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Rgba } from '../../../godot/math/math';

interface IconButtonProps {
  rect: Rect2;
  box: StyleBoxFlatData;
  size: number;
  texture: THREE.Texture | null;
  tint: NativeControlComponentProps['tint'];
  iconTint: NativeControlComponentProps['tint'];
  rtl: boolean;
  renderOrder: number;
}

/** The icon sits at the whole pixel `Button` floors to. */
export function IconButton({ rect, box, size, texture, tint, iconTint, rtl, renderOrder }: IconButtonProps) {
  const iconRect = texture
    ? iconOnlyButtonIconRectIn(
        rect,
        box.contentMargin,
        { x: size, y: size },
        rtl,
        HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
      )
    : null;
  return (
    <>
      <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
        <StyleBoxQuad
          styleBox={box}
          rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
          color={tint.own}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      {iconRect && (
        <PositionedIcon
          rect={iconRect}
          texture={texture}
          color={iconTint.color}
          opacity={iconTint.opacity}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
    </>
  );
}

/** A Button icon's colour and opacity: the Theme's icon modulate folded onto the item's tint (`button.cpp:321-329`). */
export function iconModulate(
  toItemLinear: ReturnType<typeof useItemLinearColorOf>,
  tint: NativeControlComponentProps['tint'],
  iconColor: Rgba
) {
  return {
    color: toItemLinear(multiplyModulate(tint.own, { ...iconColor, a: 1 })),
    opacity: tint.opacity * iconColor.a,
  };
}
