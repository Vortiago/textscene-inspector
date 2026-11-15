/**
 * `StyleBox::get_draw_rect`: the rect a box paints for a given rect, past its expand margins and,
 * for a flat box, its shadow.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { rect2Grow, rect2GrowIndividual, rect2Merge, type Rect2 } from '../../../godot/math/rect2';
import { isStyleBoxLine, isStyleBoxTexture, type ResolvedStyleBox } from './parseStyleBox';

/**
 * A flat box grows by its expand margins and merges its shadow (`style_box_flat.cpp:444-454`), a texture
 * box grows by its expand margins (`style_box_texture.cpp:161-163`), and a line box keeps the base
 * `StyleBox::get_draw_rect`, the rect itself (`style_box.cpp:96-102`).
 */
export function styleBoxDrawRect(box: ResolvedStyleBox, rect: Rect2): Rect2 {
  if (isStyleBoxLine(box)) return rect;
  if (isStyleBoxTexture(box)) return rect2GrowIndividual(rect, box.texture.expandMargin);
  const expanded = rect2GrowIndividual(rect, box.expandMargin);
  if (box.shadowSize <= 0) return expanded;
  const shadow = rect2Grow(expanded, box.shadowSize);
  return rect2Merge(expanded, {
    ...shadow,
    x: shadow.x + box.shadowOffset.x,
    y: shadow.y + box.shadowOffset.y,
  });
}
