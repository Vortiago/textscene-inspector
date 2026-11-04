/**
 * How an ItemList label draws at its box width: whether it draws, each line's alignment shift, and
 * the clip to the box. Follows `TextParagraph::draw` (`text_paragraph.cpp:888-921`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { clipLineToDrawBox } from '../../../../r3f/controls/native/text/lineDrawClip';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { TextLayoutResult, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';

/**
 * One line's x shift inside its box, as `TextParagraph::draw` applies it while the box has a width
 * (`text_paragraph.cpp:888-921`). A wrapped label is CENTER: a line that fits moves by half the slack,
 * floored, and a wider one stays put under LTR and moves to the trailing edge under RTL. A single
 * line is LEFT under LTR and RIGHT under RTL (`item_list.cpp:1668,1670`), which goes negative for a
 * wider line. `lineWidthPx` is `shaped_text_get_width`, ceiled (`shapedTextSizeWidthPx`).
 */
export function itemListLineShiftPx(
  lineWidthPx: number,
  boxWidthPx: number,
  wrapped: boolean,
  rtl: boolean
): number {
  if (boxWidthPx <= 0) return 0;
  if (!wrapped) return rtl ? boxWidthPx - lineWidthPx : 0;
  if (lineWidthPx <= boxWidthPx) return Math.floor((boxWidthPx - lineWidthPx) / 2);
  return rtl ? boxWidthPx - lineWidthPx : 0;
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
  return layout.lines.map((line) => {
    const shiftPx = itemListLineShiftPx(shapedTextSizeWidthPx(line.widthPx), boxWidthPx, wrapped, rtl);
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
