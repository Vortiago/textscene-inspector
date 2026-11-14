/**
 * ItemList's draw at its solved size, `NOTIFICATION_DRAW` (`scene/gui/item_list.cpp:1367-1729`), as a
 * rect share (`solveHandoff.ts`): each drawn row's icon, label and boxes, the guide lines and the
 * scroll bars, from the layout that the minimum size also reads.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rgba } from '../../../../godot/math/math';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rect2 } from '../../../../godot/math/rect2';
import { defineRectShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { soloLineLayout, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import type { ScrollBarPairBoxes } from '../shared/scrollBarSolver';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { shapeItemListText, trimItemListLine } from './itemText';
import {
  itemIconColor,
  itemIconDraw,
  itemListCursorRect,
  itemListDrawClip,
  itemListDrawsCursor,
  itemListGuideLines,
  itemListLineTextWidthPx,
  isItemListRowInClip,
  itemListRowTextX,
  itemListSelectedRect,
  itemListSeparatorsInClip,
  itemListWrappedTextWidthPx,
  itemTextColor,
  itemTextDrawOffset,
  type ItemIconDraw,
  type ItemListGuideLine,
} from './itemListGeometry';
import { isItemListLabelFillDrawn, itemListDrawnLabel } from './labelDraw';
import { itemListMirrorX } from './mirrorX';
import { hasFixedIconSize } from './itemListPack';
import { itemListIconSlotKey, itemListLayout, type ItemListLayout, type ItemListRow } from './nativeSolver';
import { itemListScrollBars, type ItemListScrollBars } from './scrollBars';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';

// --- The draw at one size ---------------------------------------------------

/** One drawn line of a row's label: its own layout, and the alignment shift `TextParagraph::draw` gave it. */
interface DrawnLabelLine {
  lineLayout: TextLayoutResult;
  shiftPx: number;
}

/** One row as the list draws it. */
export interface ItemListDrawnRow {
  /** The row's place in the list: its React key, which a repack that moves the row leaves unchanged. */
  index: number;
  item: ItemListRuntimeItem;
  iconDraw: ItemIconDraw;
  /** The icon's own colour before the list's tint (`item_list.cpp:1568-1571`). */
  iconColor: Rgba;
  /** The label at its draw width (`item_list.cpp:1625-1661`), or `null` for an item with no text. */
  label: { linePitchPx: number; lines: DrawnLabelLine[] } | null;
  /** Row-relative pen x, already through the RTL branch of `item_list.cpp:1639-1670`. */
  textX: number;
  textY: number;
  /** Row-relative icon x, already mirrored (`item_list.cpp:1582-1584`). */
  iconX: number;
  /** False where the row hides its fill and draws the outline alone (`item_list.cpp:1672-1688`). */
  isTextFillDrawn: boolean;
  rect: Rect2;
  textColor: Rgba;
  /** The background of a selected row, relative to the row's origin, or `null` for a row not selected. */
  selectedRect: Rect2 | null;
  /** The `cursor` box of the current row of a multi-select list, relative to the row's origin, or `null`. */
  cursorRect: Rect2 | null;
}

/** The list's draw at one size. */
export interface ItemListDraw {
  /** `base_ofs`, the panel's own offset (`item_list.cpp:1429`). */
  origin: Vector2;
  guideLines: readonly ItemListGuideLine[];
  /** Only the rows that reach into the list (`item_list.cpp:1493-1500`). */
  rows: readonly ItemListDrawnRow[];
  scrollBars: ItemListScrollBars;
  scrollBarBoxes: ScrollBarPairBoxes;
  /** The label font size: the theme's or the node's override. */
  fontSizePx: number;
  /** The `panel` box, and the `selected` and `cursor_unfocused` boxes a row draws (`item_list.cpp:1502-1531,2455`). */
  boxes: { panel: ResolvedStyleBox; selected: ResolvedStyleBox; cursor: ResolvedStyleBox };
  guideColor: Rgba;
}

/** What every row of one draw shares. */
interface DrawFrame {
  n: ShareNode;
  props: ItemListRuntimeProperties;
  layout: ItemListLayout;
  size: Vector2;
  origin: Vector2;
  /** The width of the vertical bar, 0 while it is hidden. */
  barWidth: number;
  /** The draw `width` (`item_list.cpp:1385-1389`): a visible vertical bar takes its width off. */
  contentWidth: number;
  wraparoundItems: boolean;
  panelMargins: StyleBoxFlatData['contentMargin'];
  /** `font_selected_color` (`item_list.cpp:1610-1611`). */
  selectedTextColor: Rgba;
  /** Whether the current row draws the `cursor` box (`itemListDrawsCursor`). */
  drawsCursor: boolean;
}

function drawFrame(n: ShareNode, size: Vector2, layout: ItemListLayout): DrawFrame {
  const props = n.node.properties as ItemListRuntimeProperties;
  const panelMargins = layout.panelBox.contentMargin;
  const barWidth = layout.packed.vertical.visible ? layout.bars.verticalWidth : 0;
  return {
    n,
    props,
    layout,
    size,
    // `base_ofs = panel_style->get_offset()` (`item_list.cpp:1429`): the left and top margins, not
    // their sums (`style_box.cpp:87-89`).
    origin: { x: panelMargins.left, y: panelMargins.top },
    barWidth,
    contentWidth: size.x - layout.panelMinimum.x - barWidth,
    wraparoundItems: props.wraparoundItems !== false,
    panelMargins,
    selectedTextColor: requiredThemeItem(n.colors, 'font_selected_color'),
    drawsCursor: itemListDrawsCursor(props.selectMode ?? 0),
  };
}

/**
 * The label at `widthPx`. A single-line label trims its one shaping. A wrapped one shapes again,
 * since its lines break at the width (`item_list.cpp:1629-1632`), unless the width is the minimum's.
 */
function labelAt(frame: DrawFrame, row: ItemListRow, widthPx: number): TextLayoutResult | null {
  const { textShape, minimumWidthPx } = frame.layout.content;
  const text = row.item.text ?? '';
  if (row.untrimmedLine) return trimItemListLine(row.untrimmedLine, { ...textShape, text }, widthPx);
  if (widthPx === minimumWidthPx || !row.minimumLabel) return row.minimumLabel;
  return shapeItemListText({ ...textShape, text, widthPx });
}

function drawnLabel(layout: TextLayoutResult | null, widthPx: number, wrapped: boolean, rtl: boolean) {
  if (!layout) return null;
  return {
    linePitchPx: layout.linePitchPx,
    // One layout object per line, made here, so a line keeps its meshes across renders.
    lines: itemListDrawnLabel(layout, widthPx, wrapped, rtl).map(({ line, shiftPx }) => ({
      lineLayout: soloLineLayout(line, layout),
      shiftPx,
    })),
  };
}

function rowColour(frame: DrawFrame, item: ItemListRuntimeItem): Rgba {
  const base = item.isSelected ? frame.selectedTextColor : frame.layout.content.textColor;
  return itemTextColor(base, item.disabled === true);
}

function rowBoxes(frame: DrawFrame, item: ItemListRuntimeItem, rowRect: Rect2) {
  const { origin, contentWidth, size, layout, n } = frame;
  const box = {
    rowRect,
    baseX: origin.x,
    columnCount: layout.packed.columnCount,
    contentWidth,
    controlWidth: size.x,
    rtl: n.rtl,
  };
  const panel = { panelMarginLeft: frame.panelMargins.left, panelMarginRight: frame.panelMargins.right };
  return {
    selectedRect: item.isSelected ? itemListSelectedRect({ ...box, ...panel }) : null,
    cursorRect: item.isCurrent && frame.drawsCursor ? itemListCursorRect(box) : null,
  };
}

function drawnRow(frame: DrawFrame, row: ItemListRow, index: number, rect: Rect2): ItemListDrawnRow {
  const { n, props, origin, contentWidth, size, wraparoundItems } = frame;
  const { spacing, textShape, isWrapped: wrapped } = frame.layout.content;
  const { hSeparation, vSeparation, iconMargin } = spacing;
  const fixedColumnWidth = props.fixedColumnWidth ?? 0;
  // Both centring passes read `rect_cache.size` (`item_list.cpp:1553,1556,1649`), never its position.
  const rowSize: Vector2 = { x: rect.w, y: rect.h };
  const iconDraw = itemIconDraw(
    row.hasIcon,
    textShape.iconMode,
    row.iconSize,
    n.textureSlots[itemListIconSlotKey(index)] ?? null,
    hasFixedIconSize(props.fixedIconSize),
    rowSize,
    hSeparation,
    vSeparation,
    iconMargin
  );
  const textOffset = itemTextDrawOffset(
    wrapped,
    iconDraw.textOffsetContribution,
    rowSize,
    row.minimumLabel?.heightPx ?? 0,
    hSeparation,
    vSeparation
  );
  // Every RTL branch works in control coordinates, and the row keeps its LTR origin, so each piece
  // comes back relative to it.
  const rowOriginX = origin.x + rect.x;
  const textWidthPx = wrapped
    ? itemListWrappedTextWidthPx(rect.w, textOffset.x, contentWidth, wraparoundItems)
    : itemListLineTextWidthPx(rect.w, textOffset.x, contentWidth, wraparoundItems);
  const textBoxX = wrapped
    ? itemListMirrorX(rowOriginX + textOffset.x, textWidthPx, size.x, n.rtl)
    : itemListRowTextX(
        {
          ltrX: rowOriginX + textOffset.x,
          itemRectWidthPx: rect.w,
          iconWidthPx: row.iconSize.x,
          controlWidthPx: size.x,
          contentWidthPx: contentWidth,
          wraparoundItems,
          hSeparation,
        },
        n.rtl
      );
  return {
    index,
    item: row.item,
    iconDraw,
    iconColor: itemIconColor(row.item.disabled === true, row.item.iconModulate),
    label: drawnLabel(labelAt(frame, row, textWidthPx), textWidthPx, wrapped, n.rtl),
    isTextFillDrawn: isItemListLabelFillDrawn({
      wrapped,
      fixedColumnWidth,
      itemRectWidthPx: rect.w,
      iconWidthPx: row.iconSize.x,
      contentWidthPx: contentWidth,
      wraparoundItems,
      hSeparation,
    }),
    textX: textBoxX - rowOriginX,
    textY: textOffset.y,
    iconX: iconDraw.rect
      ? itemListMirrorX(rowOriginX + iconDraw.rect.x, iconDraw.rect.w, size.x, n.rtl) - rowOriginX
      : 0,
    rect,
    textColor: rowColour(frame, row.item),
    ...rowBoxes(frame, row.item, rect),
  };
}

/** The rows that reach into `clip` (`item_list.cpp:1493-1500`), in list order. */
function drawnRowsIn(frame: DrawFrame, clip: Rect2): ItemListDrawnRow[] {
  const { rows } = frame.layout.content;
  const { items } = frame.layout.packed;
  const drawn: ItemListDrawnRow[] = [];
  for (let index = 0; index < rows.length; index++) {
    const rect = items[index]!.rect;
    if (isItemListRowInClip(rect, clip)) drawn.push(drawnRow(frame, rows[index]!, index, rect));
  }
  return drawn;
}

function drawAt(n: ShareNode, size: Vector2, layout: ItemListLayout): ItemListDraw {
  const frame = drawFrame(n, size, layout);
  const { props, origin, contentWidth, barWidth, wraparoundItems } = frame;
  const { packed } = layout;
  const clip = itemListDrawClip(size, origin, packed.horizontal, wraparoundItems);
  const scrollBarBoxes = internalScrollBarBoxes(n);
  return {
    origin,
    guideLines: itemListGuideLines(
      layout.content.textShape.iconMode,
      itemListSeparatorsInClip(packed.separators, clip),
      contentWidth,
      n.rtl ? barWidth : 0
    ),
    rows: drawnRowsIn(frame, clip),
    scrollBars: itemListScrollBars({
      size,
      margins: frame.panelMargins,
      vertical: packed.vertical,
      horizontal: packed.horizontal,
      rtl: n.rtl,
      boxes: scrollBarBoxes,
      bars: layout.bars,
      scrollHintMode: props.scrollHintMode ?? 0,
    }),
    scrollBarBoxes,
    fontSizePx: layout.content.textShape.fontSizePx,
    boxes: {
      panel: layout.panelBox,
      // `selected_focus` is the same box as `selected` in the table's `ItemList` type.
      selected: requiredThemeItem(n.styleBoxes, 'selected'),
      cursor: requiredThemeItem(n.styleBoxes, 'cursor_unfocused'),
    },
    guideColor: requiredThemeItem(n.colors, 'guide_color'),
  };
}

/** The draw at the painted rect, from the layout share at the same size. */
export const itemListDraw = defineRectShare((n, size, theme): ItemListDraw =>
  drawAt(n, size, itemListLayout(n, size, theme))
);
