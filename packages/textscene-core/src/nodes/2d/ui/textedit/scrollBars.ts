/**
 * Where a TextEdit places its two scroll bars and whether each shows: `TextEdit::_update_scrollbars`
 * (`scene/gui/text_edit.cpp:8587-8656`). A `.tscn` stores no scroll value, so both grabbers sit at
 * value 0 (`nativeSolver.ts`). The bars are `INTERNAL_MODE_FRONT` children (`:9291-9292`), so they
 * draw over the text. CodeEdit shares this module.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  scrollBarMinimumSize,
  scrollBarRangePlacement,
  type ScrollBarPairBoxes,
  type ScrollBarPlacement,
} from '../shared/scrollBarSolver';

interface TextEditScrollBarsInput {
  /** The control's `get_size()`. */
  size: Vector2;
  /** The active StyleBox's margins. */
  margins: StyleBoxFlatData['contentMargin'];
  rowHeightPx: number;
  /** Rows of every line that is not hidden, wrapped rows counted. A placeholder counts its own rows. */
  totalRows: number;
  /** `text.get_max_width()`: the widest shaped row, ceiled. */
  widestRowPx: number;
  /** `gutters_width + gutter_padding`. */
  gutterBandWidthPx: number;
  /** `minimap_width` when `minimap_draw` holds, otherwise 0. */
  minimapWidthPx: number;
  scrollPastEndOfFile: boolean;
  fitContentHeight: boolean;
  /** `is_layout_rtl()`: `Control::_size_changed` mirrors each bar about the control's width (`control.cpp:1785-1787`). */
  rtl: boolean;
  scrollBarBoxes: ScrollBarPairBoxes;
}

export interface TextEditScrollBars {
  horizontal: ScrollBarPlacement;
  vertical: ScrollBarPlacement;
  /** The width the vertical bar takes from the wrap width: 0 where it is hidden (`:8541-8543`). */
  verticalWidthPx: number;
  /** `_get_control_height()` (`:8658-8664`): the height below the style margins and the horizontal bar. */
  controlHeightPx: number;
}

/** `new_pos.x = parent width - pos.x - size.x` (`control.cpp:1785-1787`) under RTL. */
function mirrorX(x: number, width: number, parentWidth: number, rtl: boolean): number {
  return rtl ? parentWidth - x - width : x;
}

/**
 * The horizontal bar is decided first, because it lowers the visible rows (`_get_control_height`,
 * `:8658-8664`) that the vertical bar reads. The horizontal rect keeps the vertical bar's width
 * whether or not that bar shows (`:8596-8597`).
 */
export function textEditScrollBars(input: TextEditScrollBarsInput): TextEditScrollBars {
  const { size, margins, rowHeightPx, scrollBarBoxes } = input;
  const hMin = scrollBarMinimumSize(false, scrollBarBoxes.horizontal);
  const vMin = scrollBarMinimumSize(true, scrollBarBoxes.vertical);

  const visibleWidthPx = Math.trunc(size.x - (margins.left + margins.right));
  const totalWidthPx = input.widestRowPx + input.gutterBandWidthPx + input.minimapWidthPx;
  const hasHorizontal = totalWidthPx > visibleWidthPx;

  // Both `int`s in Godot: the style term truncates, then the bar's height comes off.
  const styleHeightControlPx = Math.trunc(size.y - (margins.top + margins.bottom));
  const controlHeightPx = Math.trunc(styleHeightControlPx - (hasHorizontal ? hMin.y : 0));
  const visibleRows = Math.trunc(controlHeightPx / rowHeightPx);
  let totalRows = input.totalRows;
  if ((input.scrollPastEndOfFile && !input.fitContentHeight) || visibleRows === 0)
    totalRows += visibleRows - 1;
  const hasVertical = !input.fitContentHeight && totalRows > visibleRows;
  const fractionalRows = Math.min(1, Math.max(0, controlHeightPx / rowHeightPx - visibleRows));

  const verticalRect: Rect2 = {
    x: mirrorX(size.x - vMin.x, vMin.x, size.x, input.rtl),
    y: margins.top,
    w: vMin.x,
    h: size.y - margins.top - margins.bottom - margins.top,
  };
  const horizontalRect: Rect2 = {
    x: mirrorX(0, size.x - vMin.x, size.x, input.rtl),
    y: size.y - hMin.y,
    w: size.x - vMin.x,
    h: hMin.y,
  };

  return {
    horizontal: scrollBarRangePlacement(
      false,
      horizontalRect,
      scrollBarBoxes.horizontal,
      { min: 0, max: totalWidthPx, page: visibleWidthPx },
      0,
      hasHorizontal
    ),
    vertical: scrollBarRangePlacement(
      true,
      verticalRect,
      scrollBarBoxes.vertical,
      { min: 0, max: totalRows, page: visibleRows + fractionalRows },
      0,
      hasVertical
    ),
    verticalWidthPx: hasVertical ? vMin.x : 0,
    controlHeightPx,
  };
}
