/**
 * An icon-only Button of the picker: its `normal` box, then the icon centred inside that box's
 * margins (`color_picker.cpp:2085,2101,2153`).
 */

import type * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { iconOnlyButtonIconRect } from '../../../../r3f/controls/native/buttonBase';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { Rect2 } from '../../../../godot/math/rect2';

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

function drawsBox({ bgColor, borderWidth }: StyleBoxFlatData): boolean {
  return bgColor.a > 0 || borderWidth.left + borderWidth.top + borderWidth.right + borderWidth.bottom > 0;
}

/** The icon sits at the whole pixel `Button` floors to. */
export function IconButton({ rect, box, size, texture, tint, iconTint, rtl, renderOrder }: IconButtonProps) {
  const local = texture
    ? iconOnlyButtonIconRect(
        { x: rect.w, y: rect.h },
        box.contentMargin,
        { x: size, y: size },
        rtl,
        HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
      )
    : null;
  return (
    <>
      {drawsBox(box) && (
        <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
          <StyleBoxQuad
            styleBox={box}
            rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
            color={tint.own}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {texture && local && (
        <PositionedIcon
          rect={{ ...local, x: rect.x + local.x, y: rect.y + local.y }}
          texture={texture}
          color={iconTint.color}
          opacity={iconTint.opacity}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}
