/**
 * The shaping of one ItemList item's text: `_shape_text` (`scene/gui/item_list.cpp:37-55`) and the
 * width each pass hands `text_buf->set_width()`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { ItemListIconMode } from '../../../../godot/scene/gui';
import { AutowrapMode, OverrunBehavior, TextDirection } from '../../../../godot/text/textServerEnums';
import { textBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';
import {
  overrunFlagsForBehavior,
  trimLayoutToWidth,
  trimLine,
  textBufferPlacement,
  type OverrunTrimFlags,
} from '../../../../r3f/controls/native/text/textOverrun';
import {
  shapeText,
  widestLineWidthPx,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../../r3f/controls/native/text/textLayout';

const { ICON_MODE_TOP } = ItemListIconMode;

/** TOP mode with `max_text_lines > 0`: the only label Godot wraps (`item_list.cpp:49,1766`). */
export function isItemListTextWrapped({
  iconMode,
  maxTextLines,
}: Pick<ItemTextShape, 'iconMode' | 'maxTextLines'>): boolean {
  return iconMode === ICON_MODE_TOP && maxTextLines > 0;
}

/**
 * The width `text_buf->set_width()` gets in the MINSIZE pass (`item_list.cpp:1763-1766`):
 * `fixed_column_width` when set, else unconstrained (Godot's `-1`, this engine's `0`). The draw pass
 * hands `shapeItemListText` its own width (`:1625-1661`).
 */
export function itemListMinimumShapeWidthPx(fixedColumnWidth: number): number {
  return fixedColumnWidth > 0 ? fixedColumnWidth : 0;
}

/** An item's own `text_direction` and `language` (`item_list.h:73-74`), which no scene changes. */
const ITEM_BIDI = { textDirection: TextDirection.TEXT_DIRECTION_AUTO, language: '' };

interface ItemTextShapeInput {
  text: string;
  fontSizePx: number;
  fontMetrics: Parameters<typeof shapeText>[1]['fontMetrics'];
  iconMode: number;
  maxTextLines: number;
  /** The `set_width()` argument. `<= 0` is unconstrained: no wrap and no trim. */
  widthPx: number;
  /** The control's `_get_locale()`, which an item's empty `language` takes (`item_list.cpp:45`). */
  locale: string;
  /** `TextServer::OverrunBehavior`. Godot default 3 (OVERRUN_TRIM_ELLIPSIS, `item_list.h:131`). */
  overrunBehavior?: number;
}

/** What shapes an item's text, apart from the width: one item and its list's theme. */
export type ItemTextShape = Omit<ItemTextShapeInput, 'widthPx'>;

/**
 * Shapes one item's text at `widthPx`, or `null` for an item with none, as `TextParagraph::_shape_lines`
 * does (`text_paragraph.cpp:225-266`). A wrapped label shows `max_text_lines` lines, and when lines
 * hide, the last shown line ends in an ellipsis unless the behaviour is `OVERRUN_NO_TRIMMING`. A
 * single-line label trims that one line to the width.
 */
export function shapeItemListText(input: ItemTextShapeInput): TextLayoutResult | null {
  if (input.text.length === 0) return null;
  if (!isItemListTextWrapped(input)) {
    return trimItemListLine(shapeItemListLine(input), input, input.widthPx);
  }
  const layout = shapeItemText(input, input.widthPx);
  const overrunFlags = itemOverrunFlags(input);
  const lines = withHiddenLinesEllipsis(layout.lines, input.maxTextLines, (line) =>
    trimItemLine(line, layout, input, input.widthPx, { ...overrunFlags, enforceEllipsis: true })
  );
  return withLines(layout, lines);
}

/**
 * A single-line label before its trim. `AUTOWRAP_OFF` shapes the same glyphs at any width, so one
 * shaping serves every width that `trimItemListLine` then cuts it to.
 */
export function shapeItemListLine(input: ItemTextShape): TextLayoutResult {
  return shapeItemText(input, 0);
}

/** A single-line label from `shapeItemListLine`, trimmed to `widthPx`. `<= 0` keeps it whole. */
export function trimItemListLine(
  line: TextLayoutResult,
  input: ItemTextShape,
  widthPx: number
): TextLayoutResult {
  return trimLayoutToWidth(line, widthPx, itemOverrunFlags(input), {
    fontMetrics: line.fontMetrics,
    fontSizePx: input.fontSizePx,
  });
}

function shapeItemText(input: ItemTextShape, widthPx: number): TextLayoutResult {
  const wrapped = isItemListTextWrapped(input);
  return shapeText(input.text, {
    ...textBidiOptions(ITEM_BIDI, input.locale),
    fontSizePx: input.fontSizePx,
    boxWidthPx: widthPx,
    // `_shape_text` (`item_list.cpp:37-55`): a wrapped label breaks at word and grapheme bounds, so
    // the break lands at the last glyph that fits (`text_server.cpp:1155-1176`), which is `AUTOWRAP_ARBITRARY`.
    autowrapMode: wrapped ? AutowrapMode.AUTOWRAP_ARBITRARY : AutowrapMode.AUTOWRAP_OFF,
    breakMandatory: wrapped,
    // Zero: `force_update_list_size` adds a flat `line_separation * max_text_lines`
    // (`item_list.cpp:1772`), which `itemContentMinSize` adds.
    lineSpacingPx: 0,
    fontMetrics: input.fontMetrics,
  });
}

function itemOverrunFlags(input: ItemTextShape): OverrunTrimFlags {
  return overrunFlagsForBehavior(input.overrunBehavior ?? OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
}

/**
 * `layout.fontMetrics`, not `input.fontMetrics`: `shapeText` defaults to the bundled face when the
 * caller passes none, and the trim must agree with the metrics that shaped these glyphs.
 */
function trimItemLine(
  line: TextLineLayout,
  layout: TextLayoutResult,
  input: ItemTextShape,
  widthPx: number,
  flags: OverrunTrimFlags
): TextLineLayout {
  const options = { fontMetrics: layout.fontMetrics, fontSizePx: input.fontSizePx };
  return trimLine(line, widthPx, flags, options, textBufferPlacement(layout.isDrawnRtl === true));
}

function withLines(layout: TextLayoutResult, lines: readonly TextLineLayout[]): TextLayoutResult {
  return {
    ...layout,
    lines: [...lines],
    widthPx: widestLineWidthPx(lines),
    heightPx: lines.length * layout.linePitchPx,
  };
}

/** The first `maxLines` lines, the last one passed through `trimLast` when any line hides (`text_paragraph.cpp:229-261`). */
function withHiddenLinesEllipsis(
  lines: readonly TextLineLayout[],
  maxLines: number,
  trimLast: (line: TextLineLayout) => TextLineLayout
): TextLineLayout[] {
  if (lines.length <= maxLines) return [...lines];
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = trimLast(visible[maxLines - 1]!);
  return visible;
}
