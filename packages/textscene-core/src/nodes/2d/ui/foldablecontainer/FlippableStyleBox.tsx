/**
 * `FoldableContainer::_draw_flippable_stylebox` (`scene/gui/foldable_container.cpp:523-532`): a box
 * of a bottom-title container draws mirrored on the Y axis, so one box, authored for the top title,
 * puts its square edge against the panel at either `title_position`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rgba } from '../../../../godot/math/math';
import type { Rect2 } from '../../../../godot/math/rect2';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import {
  isStyleBoxLine,
  isStyleBoxTexture,
  type ResolvedStyleBox,
} from '../../../../r3f/controls/native/parseStyleBox';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';

/**
 * The height of `get_draw_rect` for a rect `height` tall: the expand margins, and for a flat box the
 * shadow it merges in (`style_box_flat.cpp:444-454`, `style_box_texture.cpp:161-163`). A line box
 * keeps the base `StyleBox::get_draw_rect`, the rect itself (`style_box.cpp:96-102`).
 */
export function styleBoxDrawHeight(box: ResolvedStyleBox, height: number): number {
  if (isStyleBoxLine(box)) return height;
  const expand = isStyleBoxTexture(box) ? box.texture.expandMargin : box.expandMargin;
  const top = -expand.top;
  const bottom = height + expand.bottom;
  if (isStyleBoxTexture(box) || box.shadowSize <= 0) return bottom - top;
  const shadowTop = top - box.shadowSize + box.shadowOffset.y;
  const shadowBottom = bottom + box.shadowSize + box.shadowOffset.y;
  return Math.max(bottom, shadowBottom) - Math.min(top, shadowTop);
}

interface FlippableStyleBoxProps {
  styleBox: ResolvedStyleBox;
  rect: Rect2;
  /** `title_position == POSITION_BOTTOM`. */
  isFlipped: boolean;
  /** The CanvasItem tint in raw sRGB, as `<StyleBoxQuad>` takes it. */
  color: Rgba;
  renderOrder: number;
}

/**
 * Under the flip, Godot draws at `Rect2(-position, size)` through the transform `y -> h - y`, with `h`
 * the draw rect's height. That lands the box on `rect` mirrored, shifted down by any expand margin or
 * shadow, as Godot shifts it. The mirrored group holds no text, so the canvas origin it skips is unread.
 */
export function FlippableStyleBox({ styleBox, rect, isFlipped, color, renderOrder }: FlippableStyleBoxProps) {
  const quad = <StyleBoxQuad styleBox={styleBox} color={color} rect={rect} renderOrder={renderOrder} />;
  if (!isFlipped) return <CanvasItemGroup position={[rect.x, -rect.y, 0]}>{quad}</CanvasItemGroup>;
  const drawHeight = styleBoxDrawHeight(styleBox, rect.h);
  return (
    <CanvasItemGroup position={[0, -drawHeight, 0]} scale={[1, -1, 1]}>
      <CanvasItemGroup position={[-rect.x, rect.y, 0]}>{quad}</CanvasItemGroup>
    </CanvasItemGroup>
  );
}
