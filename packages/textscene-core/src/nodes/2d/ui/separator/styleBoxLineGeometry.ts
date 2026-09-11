/**
 * The rect a `Separator` hands its `StyleBoxLine` to draw — `Separator::
 * _notification(NOTIFICATION_DRAW)` (`scene/gui/separator.cpp:47-60`) composed
 * with `StyleBoxLine::draw` (`scene/resources/style_box_line.cpp:86-100`),
 * `Separator` being the only caller either has in this codebase.
 *
 * Every intermediate is an INTEGER in the C++ (`Size2i`/`Rect2i`), so this
 * truncates at the SAME two points Godot does, with `Math.trunc` rather than
 * `Math.floor` — C++'s `int / int` rounds toward zero, which disagrees with
 * floor the moment the cross-axis offset goes negative (a stylebox margin sum
 * wider than the node's own rect).
 */

import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SeparatorOrientation, StyleBoxLineData } from './styleBoxLine';

/** C++ `int / 2` truncates toward zero; `Math.floor` would not for a negative dividend. */
function truncHalf(n: number): number {
  return Math.trunc(n / 2);
}

/**
 * `separator.cpp:47-60` + `style_box_line.cpp:86-100`. `orientation` is the
 * owning `Separator`'s own (fixed per HSeparator/VSeparator); `box.vertical`
 * is the StyleBoxLine RESOURCE's own field, which can disagree with it for a
 * hand-authored override — `Separator` computes the placement rect from its
 * OWN orientation, but `StyleBoxLine::draw` grows/thickens along ITS OWN
 * `vertical` flag, so both are read independently here exactly as the two
 * C++ call sites do.
 */
export function separatorLineDrawRect(
  orientation: SeparatorOrientation,
  rect: Rect2,
  box: StyleBoxLineData
): Rect2 {
  // separator.cpp:48-49: `Size2i size = get_size()`.
  const size = { x: Math.trunc(rect.w), y: Math.trunc(rect.h) };
  // separator.cpp:49: `Size2i ssize = separator_style->get_minimum_size()` —
  // `StyleBox::get_minimum_size` (style_box.cpp:35-36) sums the four resolved
  // margins as FLOATS first, truncating only the sum.
  const ssize = {
    x: Math.trunc(box.margin.left + box.margin.right),
    y: Math.trunc(box.margin.top + box.margin.bottom),
  };

  // separator.cpp:51-56.
  const placed =
    orientation === 'vertical'
      ? { x: truncHalf(size.x - ssize.x), y: 0, w: ssize.x, h: size.y }
      : { x: 0, y: truncHalf(size.y - ssize.y), w: size.x, h: ssize.y };

  // style_box_line.cpp:86-100: `Rect2i r = p_rect` (no-op — `placed` is
  // already integer-valued), then grown/thickened along the STYLEBOX's own
  // `vertical` flag.
  if (box.vertical) {
    return {
      x: placed.x,
      y: Math.trunc(placed.y - box.growBegin),
      w: box.thickness,
      h: Math.trunc(placed.h + box.growBegin + box.growEnd),
    };
  }
  return {
    x: Math.trunc(placed.x - box.growBegin),
    y: placed.y,
    w: Math.trunc(placed.w + box.growBegin + box.growEnd),
    h: box.thickness,
  };
}
