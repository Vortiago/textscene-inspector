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
import { rect2Intersects, type Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { ItemListIconMode, ItemListSelectMode } from '../../../../godot/scene/gui';
import { defineRectShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { soloLineLayout, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { ScrollBarPairBoxes } from '../shared/scrollBarSolver';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import {
  isItemListTextWrapped,
  itemListMinimumShapeWidthPx,
  shapeItemListText,
  trimItemListLine,
} from './itemText';
import { isItemListLabelFillDrawn, itemListDrawnLabel } from './labelDraw';
import { itemListMirrorX } from './mirrorX';
import {
  ICON_MODE_LEFT,
  itemListIconSlotKey,
  itemListLayout,
  itemListTextTheme,
  type ItemListLayout,
  type ItemListRow,
  type ItemListScrollRange,
} from './nativeSolver';
import { itemListScrollBars, type ItemListScrollBars } from './scrollBars';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';

const { ICON_MODE_TOP } = ItemListIconMode;

// --- Draw-time per-item geometry (item_list.cpp:1536-1691) ----------------

/**
 * `_adjust_to_max_size` (`item_list.cpp:1186-1197`): fits `size` inside
 * `maxSize`, preserving aspect, centred. Every `int(...)` cast in the source
 * truncates toward zero.
 */
function adjustToMaxSize(size: Vector2, maxSize: Vector2): Rect2 {
  if (size.y === 0 || size.x === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let texWidth = Math.trunc((size.x * maxSize.y) / size.y);
  let texHeight = maxSize.y;
  if (texWidth > maxSize.x) {
    texWidth = maxSize.x;
    texHeight = Math.trunc((size.y * texWidth) / size.x);
  }
  const ofsX = Math.trunc((maxSize.x - texWidth) / 2);
  const ofsY = Math.trunc((maxSize.y - texHeight) / 2);
  return { x: ofsX, y: ofsY, w: texWidth, h: texHeight };
}

export interface ItemIconDraw {
  /** Relative to the item's own rect origin. `null` when the item has no icon. */
  rect: Rect2 | null;
  /** `icon_size.height + icon_margin` (TOP) or `icon_size.width + icon_margin` (LEFT): the pen offset the text inherits. */
  textOffsetContribution: Vector2;
}

/**
 * `item_list.cpp:1536-1566,1573-1585`. `icon_region` and `icon_transposed` are no
 * `PropertyListHelper` leaf, so the region is the full icon and nothing transposes.
 */
export function itemIconDraw(
  hasIcon: boolean,
  iconMode: number,
  packedIconSize: Vector2,
  naturalSize: Vector2 | null,
  fixedIconSizeSet: boolean,
  itemRectSize: Vector2,
  hSeparation: number,
  vSeparation: number,
  iconMargin: number
): ItemIconDraw {
  if (!hasIcon) return { rect: null, textOffsetContribution: { x: 0, y: 0 } };

  let x = 0;
  let y = 0;
  if (iconMode === ICON_MODE_TOP) {
    y += Math.max(vSeparation, 0) / 2;
    x += Math.floor((itemRectSize.x - packedIconSize.x) / 2);
  } else {
    x += Math.max(hSeparation, 0) / 2;
    y += Math.floor((itemRectSize.y - packedIconSize.y) / 2);
  }

  let rect: Rect2 = { x, y, w: packedIconSize.x, h: packedIconSize.y };
  if (fixedIconSizeSet && naturalSize) {
    const adj = adjustToMaxSize(naturalSize, packedIconSize);
    rect = { x: rect.x + adj.x, y: rect.y + adj.y, w: adj.w, h: adj.h };
  }

  const textOffsetContribution =
    iconMode === ICON_MODE_TOP
      ? { x: 0, y: packedIconSize.y + iconMargin }
      : { x: packedIconSize.x + iconMargin, y: 0 };

  return { rect, textOffsetContribution };
}

/**
 * `item_list.cpp:1606-1691`'s LTR pen origin, before the RTL branches
 * (`itemListRowTextX`/`itemListMirrorX`) move it. Wrapped text (`isItemListTextWrapped`) centres
 * (`HORIZONTAL_ALIGNMENT_CENTER`). A single line is aligned LEFT under LTR and RIGHT under RTL
 * (`:1668,1670`).
 */
export function itemTextDrawOffset(
  isWrapped: boolean,
  iconOffset: Vector2,
  itemRectSize: Vector2,
  textLineHeightTotal: number,
  hSeparation: number,
  vSeparation: number
): Vector2 {
  if (isWrapped) {
    return {
      x: iconOffset.x + Math.max(hSeparation, 0) / 2,
      y: iconOffset.y + Math.max(vSeparation, 0) / 2,
    };
  }
  return {
    x: iconOffset.x + Math.max(hSeparation, 0) / 2,
    y: iconOffset.y + (itemRectSize.y - textLineHeightTotal) / 2,
  };
}

// --- Per-item colour: item_list.cpp:1568-1571,1607-1622, minus hovered ---

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `icon_modulate` is no `PropertyListHelper` leaf, so a scene row keeps its class default `Color(1,1,1,1)` (`item_list.h:68`). A dialog sets it. `disabled` halves the alpha (`item_list.cpp:1569-1571`). */
export function itemIconColor(disabled: boolean, tint: Rgba = WHITE): Rgba {
  return disabled ? { ...tint, a: tint.a * 0.5 } : tint;
}

/** `custom_fg` is likewise never authorable, so `txt_modulate` always resolves to `font_color`, dimmed on `disabled` (`item_list.cpp:1614-1622`). */
export function itemTextColor(baseColor: Rgba, disabled: boolean): Rgba {
  return disabled ? { ...baseColor, a: baseColor.a * 0.5 } : baseColor;
}

// --- Row/column guide lines: item_list.cpp:1446-1459 -----------------------

export interface ItemListGuideLine {
  /**
   * Content-relative top of the hairline quad: the caller adds the panel's own offset (`origin`,
   * `item_list.cpp:1429`).
   */
  y: number;
  /** From the panel's left content edge: the vertical bar's width under RTL, else 0 (`item_list.cpp:1454-1457`). */
  x: number;
  /** The draw `width` (`item_list.cpp:1385-1389`), already less a visible vertical bar. */
  width: number;
}

/**
 * `item_list.cpp:1446-1459`'s separator draw without the scroll clip: a `.tscn` stores no scroll
 * value, so no separator is scrolled out of view.
 */
export function itemListGuideLines(
  iconMode: number,
  separators: readonly number[],
  width: number,
  startX: number
): ItemListGuideLine[] {
  if (iconMode === ICON_MODE_TOP) return [];
  return separators.map((y) => ({ y, x: startX, width }));
}

/**
 * `const Rect2 clip(-base_ofs, size)` (`item_list.cpp:1431-1441`) in the packed content's space,
 * with a zero scroll. `size.width` grows by the horizontal range's scroll span only without
 * `wraparound_items`.
 */
export function itemListDrawClip(
  size: Vector2,
  panelOffset: Vector2,
  horizontal: ItemListScrollRange,
  wraparoundItems: boolean
): Rect2 {
  const scrollSpan = wraparoundItems ? 0 : horizontal.max - horizontal.page;
  return { x: -panelOffset.x, y: -panelOffset.y, w: size.x + scrollSpan, h: size.y };
}

/** The rows `NOTIFICATION_DRAW` draws: each must intersect `clip` (`item_list.cpp:1493-1500`). */
export function itemListRowsInClip<Row extends { rect: Rect2 }>(rows: readonly Row[], clip: Rect2): Row[] {
  return rows.filter((row) => rect2Intersects(clip, row.rect));
}

/** The separators `NOTIFICATION_DRAW` draws: it stops at the first one below `clip` (`item_list.cpp:1451`). */
export function itemListSeparatorsInClip(separators: readonly number[], clip: Rect2): number[] {
  return separators.filter((y) => y <= clip.y + clip.h);
}

// --- RTL draw geometry: item_list.cpp:1629-1641,1657-1668 ----------------

interface ItemListRowTextXInput {
  /** `base_ofs.x + rect_cache.position.x + text_ofs.x`: the LTR pen origin. */
  ltrX: number;
  itemRectWidthPx: number;
  /** `icon_size.x`, the item's own packed icon width: zero without an icon. */
  iconWidthPx: number;
  controlWidthPx: number;
  /** `width` (`item_list.cpp:1387`), the panel's own content width. */
  contentWidthPx: number;
  wraparoundItems: boolean;
  hSeparation: number;
}

/**
 * The single-line pen origin (`item_list.cpp:1664-1667`). The RTL arm lands
 * `h_separation/2 - icon_margin` off a mirror of the LTR box, so the label sits
 * a different distance from its icon in each direction, as in the engine.
 */
export function itemListRowTextX(input: ItemListRowTextXInput, rtl: boolean): number {
  if (!rtl) return input.ltrX;
  let x =
    input.controlWidthPx -
    input.itemRectWidthPx +
    input.iconWidthPx -
    input.ltrX +
    Math.max(input.hSeparation, 0);
  if (input.wraparoundItems) x += Math.max(input.itemRectWidthPx - input.contentWidthPx, 0);
  return x;
}

/**
 * The width `text_buf->set_width()` gets for a single-line item
 * (`item_list.cpp:1657-1660`): the row less the text pen offset, shrunk
 * again by whatever the row overflows the content width by.
 */
export function itemListLineTextWidthPx(
  itemRectWidthPx: number,
  textOffsetX: number,
  contentWidthPx: number,
  wraparoundItems: boolean
): number {
  let w = itemRectWidthPx - textOffsetX;
  if (wraparoundItems && itemRectWidthPx > contentWidthPx) w -= itemRectWidthPx - contentWidthPx;
  return w;
}

/**
 * The same width for a wrapped item (`item_list.cpp:1629-1632`): the row
 * inset by the pen offset on both sides, clamped so the box cannot run past
 * the content width.
 */
export function itemListWrappedTextWidthPx(
  itemRectWidthPx: number,
  textOffsetX: number,
  contentWidthPx: number,
  wraparoundItems: boolean
): number {
  const w = itemRectWidthPx - textOffsetX * 2;
  if (wraparoundItems && w + textOffsetX > contentWidthPx) return contentWidthPx - textOffsetX;
  return w;
}

/** A one-column row's background and cursor run to the right edge of the content (`item_list.cpp:1502-1504`). */
function rowBackgroundWidth(input: { rowRect: Rect2; columnCount: number; contentWidth: number }): number {
  return input.columnCount === 1 ? input.contentWidth - input.rowRect.x : input.rowRect.w;
}

/**
 * The rect a selected row's background fills, relative to the row's own origin (`item_list.cpp:1502-1517`),
 * mirrored inside the control under RTL.
 */
export function itemListSelectedRect(input: {
  rowRect: Rect2;
  /** `base_ofs.x`, the panel's left margin. */
  baseX: number;
  columnCount: number;
  contentWidth: number;
  controlWidth: number;
  panelMarginLeft: number;
  panelMarginRight: number;
  rtl: boolean;
}): Rect2 {
  const w = rowBackgroundWidth(input);
  const ltrX = input.baseX + input.rowRect.x;
  const x = input.rtl ? input.controlWidth - ltrX - w + input.panelMarginLeft - input.panelMarginRight : ltrX;
  return { x: x - ltrX, y: 0, w, h: input.rowRect.h };
}

/** Whether the list marks its current row with the `cursor` box: only one that selects several rows (`item_list.cpp:1693`). */
export function itemListDrawsCursor(selectMode: number): boolean {
  return selectMode === ItemListSelectMode.SELECT_MULTI || selectMode === ItemListSelectMode.SELECT_TOGGLE;
}

/** The rect of the `cursor` box, relative to the row's origin. RTL mirrors it without the panel margins (`item_list.cpp:1698-1705`). */
export function itemListCursorRect(input: {
  rowRect: Rect2;
  baseX: number;
  columnCount: number;
  contentWidth: number;
  controlWidth: number;
  rtl: boolean;
}): Rect2 {
  return itemListSelectedRect({ ...input, panelMarginLeft: 0, panelMarginRight: 0 });
}

// --- The draw at one size ---------------------------------------------------

/** One drawn line of a row's label: its own layout, and the alignment shift `TextParagraph::draw` gave it. */
export interface DrawnLabelLine {
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
}

/** What every row of one draw shares. */
interface DrawFrame {
  n: ShareNode;
  props: ItemListRuntimeProperties;
  layout: ItemListLayout;
  size: Vector2;
  origin: Vector2;
  /** The draw `width` (`item_list.cpp:1385-1389`): a visible vertical bar takes its width off. */
  contentWidth: number;
  panelMargins: StyleBoxFlatData['contentMargin'];
}

/** `base_ofs = panel_style->get_offset()` (`item_list.cpp:1429`): the left and top margins, not their sums (`style_box.cpp:87-89`). */
function drawFrame(n: ShareNode, size: Vector2, layout: ItemListLayout): DrawFrame {
  const panelMargins = requiredThemeItem(n.styleBoxes, 'panel').contentMargin;
  const barWidth = layout.packed.vertical.visible ? layout.bars.verticalWidth : 0;
  return {
    n,
    props: n.node.properties as ItemListRuntimeProperties,
    layout,
    size,
    origin: { x: panelMargins.left, y: panelMargins.top },
    contentWidth: size.x - layout.panelMinimum.x - barWidth,
    panelMargins,
  };
}

/**
 * The label at `widthPx`. A single-line label trims its one shaping. A wrapped one shapes again,
 * since its lines break at the width (`item_list.cpp:1629-1632`), unless the width is the minimum's.
 */
function labelAt(frame: DrawFrame, row: ItemListRow, widthPx: number): TextLayoutResult | null {
  const shape = { ...frame.layout.content.textShape, text: row.item.text ?? '' };
  if (row.untrimmedLine) return trimItemListLine(row.untrimmedLine, shape, widthPx);
  const minimumWidthPx = itemListMinimumShapeWidthPx(frame.props.fixedColumnWidth ?? 0);
  if (widthPx === minimumWidthPx || !row.minimumLabel) return row.minimumLabel;
  return shapeItemListText({ ...shape, widthPx });
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
  // `font_selected_color` (`item_list.cpp:1610-1611`).
  const base = item.isSelected
    ? requiredThemeItem(frame.n.colors, 'font_selected_color')
    : itemListTextTheme(frame.n, frame.props).color;
  return itemTextColor(base, item.disabled === true);
}

function rowBoxes(frame: DrawFrame, row: ItemListRow, rowRect: Rect2) {
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
  const drawsCursor = itemListDrawsCursor(frame.props.selectMode ?? 0);
  return {
    selectedRect: row.item.isSelected ? itemListSelectedRect({ ...box, ...panel }) : null,
    cursorRect: row.item.isCurrent && drawsCursor ? itemListCursorRect(box) : null,
  };
}

function drawnRow(frame: DrawFrame, row: ItemListRow, index: number): ItemListDrawnRow {
  const { n, props, origin, contentWidth, size } = frame;
  const { hSeparation, vSeparation, iconMargin } = frame.layout.content.spacing;
  const iconMode = props.iconMode ?? ICON_MODE_LEFT;
  const wraparoundItems = props.wraparoundItems !== false;
  const fixedColumnWidth = props.fixedColumnWidth ?? 0;
  const rect = frame.layout.packed.items[index]!.rect;
  // Both centring passes read `rect_cache.size` (`item_list.cpp:1553,1556,1649`), never its position.
  const rowSize: Vector2 = { x: rect.w, y: rect.h };
  const fixedIconSize = props.fixedIconSize;
  const iconDraw = itemIconDraw(
    row.hasIcon,
    iconMode,
    row.iconSize,
    n.textureSlots[itemListIconSlotKey(index)] ?? null,
    !!(fixedIconSize && fixedIconSize.x > 0 && fixedIconSize.y > 0),
    rowSize,
    hSeparation,
    vSeparation,
    iconMargin
  );
  const wrapped = isItemListTextWrapped(iconMode, props.maxTextLines ?? 1);
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
    ...rowBoxes(frame, row, rect),
  };
}

function drawAt(n: ShareNode, size: Vector2, layout: ItemListLayout): ItemListDraw {
  const frame = drawFrame(n, size, layout);
  const { props, origin, contentWidth } = frame;
  const { packed } = layout;
  const wraparoundItems = props.wraparoundItems !== false;
  const clip = itemListDrawClip(size, origin, packed.horizontal, wraparoundItems);
  const barWidth = packed.vertical.visible ? layout.bars.verticalWidth : 0;
  const scrollBarBoxes = internalScrollBarBoxes(n);
  const rows = layout.content.rows.map((row, index) => ({ row, index, rect: packed.items[index]!.rect }));
  return {
    origin,
    guideLines: itemListGuideLines(
      props.iconMode ?? ICON_MODE_LEFT,
      itemListSeparatorsInClip(packed.separators, clip),
      contentWidth,
      n.rtl ? barWidth : 0
    ),
    rows: itemListRowsInClip(rows, clip).map(({ row, index }) => drawnRow(frame, row, index)),
    scrollBars: itemListScrollBars({
      size,
      margins: frame.panelMargins,
      vertical: packed.vertical,
      horizontal: packed.horizontal,
      rtl: n.rtl,
      boxes: scrollBarBoxes,
      scrollHintMode: props.scrollHintMode ?? 0,
    }),
    scrollBarBoxes,
    fontSizePx: layout.content.textShape.fontSizePx,
  };
}

/** The draw at the painted rect, from the layout share at the same size. */
export const itemListDraw = defineRectShare((n, size, theme): ItemListDraw =>
  drawAt(n, size, itemListLayout(n, size, theme))
);
