/**
 * How an ItemList label draws at its box width: whether it draws, each line's alignment shift, and
 * the clip to the box. Follows `TextParagraph::draw` (`text_paragraph.cpp:888-921`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import {
  clipLineToDrawBox,
  textParagraphLineShiftPx,
} from '../../../../r3f/controls/native/text/lineDrawClip';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { TextLayoutResult, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';

/**
 * The alignment ItemList gives its label's paragraph: CENTER for a wrapped label, and for a single
 * line LEFT under LTR and RIGHT under RTL (`item_list.cpp:1668,1670`).
 */
function itemListLabelAlignment(wrapped: boolean, rtl: boolean): number {
  if (wrapped) return HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER;
  return rtl ? HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT : HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT;
}

/** A label line, cut to its box, with its x shift from the box origin. */
export interface DrawnLabelLine {
  line: TextLineLayout;
  shiftPx: number;
}

/**
 * The label as `TextParagraph::draw` paints it at `boxWidthPx`: each line shifted by its alignment
 * and cut to the box (`clipLineToDrawBox`). `layout` supplies the pitch and baseline.
 */
export function itemListDrawnLabel(
  layout: TextLayoutResult,
  boxWidthPx: number,
  wrapped: boolean,
  rtl: boolean
): DrawnLabelLine[] {
  const alignment = itemListLabelAlignment(wrapped, rtl);
  return layout.lines.map((line) => {
    // `lineWidthPx` is `shaped_text_get_width`, ceiled.
    const shiftPx = textParagraphLineShiftPx(shapedTextSizeWidthPx(line.widthPx), boxWidthPx, alignment, rtl);
    return { line: clipLineToDrawBox(line, boxWidthPx, shiftPx), shiftPx };
  });
}

interface ItemListLabelDrawInput {
  /** `isItemListTextWrapped`: a wrapped label always draws. */
  wrapped: boolean;
  fixedColumnWidth: number;
  itemRectWidthPx: number;
  /** `icon_size.x`, the item's own packed icon width: zero without an icon. */
  iconWidthPx: number;
  contentWidthPx: number;
  wraparoundItems: boolean;
  hSeparation: number;
}

/**
 * Whether the row's label draws at all (`item_list.cpp:1676-1688`). A single-line label needs room
 * past its icon and separation: in the row under `fixed_column_width`, else in the content under
 * `wraparound_items`. The horizontal scroll value that `:1682` subtracts is zero in a static file.
 */
export function itemListLabelIsDrawn(input: ItemListLabelDrawInput): boolean {
  if (input.wrapped) return true;
  const room = (widthPx: number) => widthPx - input.iconWidthPx - Math.max(input.hSeparation, 0) > 0;
  if (input.fixedColumnWidth > 0) return room(input.itemRectWidthPx);
  if (input.wraparoundItems) return room(input.contentWidthPx);
  return true;
}
