/**
 * A StyleBox drawn mirrored on the Y axis about its draw rect, so one box authored for the top puts its
 * square edge against the other side: `FoldableContainer::_draw_flippable_stylebox`
 * (`scene/gui/foldable_container.cpp:523-532`) and `TabBar::_draw_tab` (`scene/gui/tab_bar.cpp:648-654`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../godot/math/rect2';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import type { ResolvedStyleBox } from './parseStyleBox';
import { PositionedStyleBox } from './PositionedStyleBox';
import { styleBoxDrawRect } from './styleBoxDrawRect';

interface FlippableStyleBoxProps {
  box: ResolvedStyleBox;
  rect: Rect2;
  /** FoldableContainer's `title_position == POSITION_BOTTOM`, TabBar's `tab_style_v_flip`. */
  isFlipped: boolean;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/**
 * Under the flip, Godot draws at `Rect2(-position, size)` through the transform `y -> h - y`, with `h`
 * the draw rect's height. That lands the box on `rect` mirrored, shifted down by any expand margin or
 * shadow, as Godot shifts it. The mirrored group holds no text, so the canvas origin it skips is unread.
 */
export function FlippableStyleBox({ box, rect, isFlipped, tint, renderOrder }: FlippableStyleBoxProps) {
  if (!isFlipped) return <PositionedStyleBox box={box} rect={rect} tint={tint} renderOrder={renderOrder} />;
  const mirrored: Rect2 = { x: -rect.x, y: -rect.y, w: rect.w, h: rect.h };
  return (
    <CanvasItemGroup position={[0, -styleBoxDrawRect(box, mirrored).h, 0]} scale={[1, -1, 1]}>
      <PositionedStyleBox box={box} rect={mirrored} tint={tint} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}
