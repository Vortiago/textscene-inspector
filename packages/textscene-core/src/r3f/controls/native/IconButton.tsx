/**
 * An icon-only Button: its box, then the icon centred inside that box's margins
 * (`color_picker.cpp:2085,2101,2153`, `button.cpp:349-405`). A box that paints nothing draws nothing.
 */

import type * as THREE from 'three';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import { multiplyModulate, type useItemLinearColorOf } from '../../canvasItemModulate';
import { PositionedIcon } from './PositionedIcon';
import { PositionedStyleBox } from './PositionedStyleBox';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { iconOnlyButtonIconRectIn } from './buttonBase';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Rgba } from '../../../godot/math/math';

interface IconButtonProps {
  rect: Rect2;
  box: StyleBoxFlatData;
  size: number;
  texture: THREE.Texture | null;
  tint: NativeControlComponentProps['tint'];
  iconTint: Pick<NativeControlComponentProps['tint'], 'color' | 'opacity'>;
  rtl: boolean;
  /** `icon_alignment` of the Button: LEFT unless the owner sets it (`button.h:55`). */
  iconAlignment: number;
  renderOrder: number;
  /** The order of the box when it differs from the icon's. Defaults to `renderOrder`. */
  boxRenderOrder?: number;
  /** The icon group's own canvas key, for an icon drawn at another canvas position (`PositionedIcon`). Omitted, it inherits the item's. */
  canvasKey?: number;
}

/** The icon sits at the whole pixel `Button` floors to. */
export function IconButton({
  rect,
  box,
  size,
  texture,
  tint,
  iconTint,
  rtl,
  iconAlignment,
  renderOrder,
  boxRenderOrder = renderOrder,
  canvasKey,
}: IconButtonProps) {
  const iconRect = texture
    ? iconOnlyButtonIconRectIn(rect, box.contentMargin, { x: size, y: size }, rtl, iconAlignment)
    : null;
  return (
    <>
      <PositionedStyleBox box={box} rect={rect} tint={tint} renderOrder={boxRenderOrder} />
      {iconRect && (
        <PositionedIcon
          rect={iconRect}
          texture={texture}
          color={iconTint.color}
          opacity={iconTint.opacity}
          renderOrder={renderOrder}
          canvasKey={canvasKey}
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
