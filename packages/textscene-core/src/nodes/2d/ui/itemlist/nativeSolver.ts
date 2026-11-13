/**
 * ItemList's native (WebGL canvas) rect solver: `ItemList::force_update_list_size`
 * (`scene/gui/item_list.cpp:1733-1912`), its per-item minsize (`:1743-1796`), `get_minimum_size`
 * (`:2136-2146`) and the draw-time icon fit `_adjust_to_max_size` (`:1186-1197`). Pure per-node
 * math, no THREE or React. `comparison.md` lists what it leaves out, under Known limitations.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TscnNode } from '../../../../parser/types';
import {
  controlSolverRegistry,
  type MinimumSizeFn,
  type TextureSlotRequest,
  type TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  overrunFlagsForBehavior,
  trimTextBufferLineToWidth,
  type OverrunTrimFlags,
} from '../../../../r3f/controls/native/text/textOverrun';
import {
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../../r3f/controls/native/text/textLayout';
import { rect2Intersects, type Rect2 } from '../../../../godot/math/rect2';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { scrollBarThicknesses } from '../shared/scrollBarSolver';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { AutowrapMode, OverrunBehavior, TextDirection } from '../../../../godot/text/textServerEnums';
import { isDrawnRtl, textBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';
import { ItemListIconMode, ItemListSelectMode } from '../../../../godot/scene/gui';

// --- Enum literals ------------------------------------------------------

/** `ItemList::IconMode` (`item_list.h:43-44`). */
const { ICON_MODE_TOP, ICON_MODE_LEFT } = ItemListIconMode;
export { ICON_MODE_LEFT };

// --- Theme font ----------------------------------------------------------

/** ItemList's own theme font key, `SceneStringName(font)`, which the default theme registers under ItemList. */
export const ITEM_LIST_THEME_FONT_KEY = 'font';

const ITEM_LIST_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** Resolves ItemList's own theme font size/colour (overrides, else the ancestor Theme chain / theme default). */
export function itemListTextTheme(n: SolveNode, props: ItemListRuntimeProperties): ResolvedTextTheme {
  return resolveTextTheme(n, props, ITEM_LIST_THEME_KEYS);
}

// --- Texture slots: one per item icon ------------------------------------

/** The `SolveNode.textureSlots` key for row `index`'s own icon. */
export function itemListIconSlotKey(index: number): string {
  return `item_${index}`;
}

/** True for a row that names an icon by `item_N/icon` or, in a dialog, by theme icon. */
export function itemHasIcon(item: ItemListRuntimeItem): boolean {
  return item.icon !== undefined || item.themedIcon !== undefined;
}

/** `item_N/icon` (`item_list.cpp:2464`): one slot request per row that names an icon. */
const itemListTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as ItemListRuntimeProperties;
  const requests: TextureSlotRequest[] = [];
  (props.items ?? []).forEach((item, index) => {
    if (item.icon) requests.push({ key: itemListIconSlotKey(index), ref: item.icon });
  });
  return requests;
};

/** The ItemList spacing constants (`item_list.cpp:2431-2449`), after the node's overrides. */
export interface ItemListSpacing {
  hSeparation: number;
  vSeparation: number;
  iconMargin: number;
  lineSeparation: number;
}

export function itemListSpacing(constants: SolveNode['constants']): ItemListSpacing {
  return {
    hSeparation: requiredThemeItem(constants, 'h_separation'),
    vSeparation: requiredThemeItem(constants, 'v_separation'),
    iconMargin: requiredThemeItem(constants, 'icon_margin'),
    lineSeparation: requiredThemeItem(constants, 'line_separation'),
  };
}

// --- Icon geometry ---------------------------------------------------------

/**
 * `Item::get_icon_size() * icon_scale`, or `fixed_icon_size * icon_scale`
 * when `fixed_icon_size` is set on both axes (`item_list.cpp:1538-1542,1746-1750`).
 * `naturalSize` is `null` until the icon texture resolves: treated as "no
 * icon contribution yet" (`button/nativeSolver.ts`'s established convention).
 */
export function itemIconPackedSize(
  hasIcon: boolean,
  naturalSize: Vector2 | null,
  fixedIconSize: Vector2 | undefined,
  iconScale: number
): Vector2 {
  if (!hasIcon) return { x: 0, y: 0 };
  if (fixedIconSize && fixedIconSize.x > 0 && fixedIconSize.y > 0) {
    return { x: fixedIconSize.x * iconScale, y: fixedIconSize.y * iconScale };
  }
  const nat = naturalSize ?? { x: 0, y: 0 };
  return { x: nat.x * iconScale, y: nat.y * iconScale };
}

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

// --- Per-item text shaping --------------------------------------------------

/**
 * `_shape_text` (`item_list.cpp:37-55`): TOP icon mode with `max_text_lines > 0` breaks at word and
 * grapheme bounds, else one line. `BREAK_GRAPHEME_BOUND` marks every glyph a safe break after
 * `BREAK_WORD_BOUND` marked a word (`text_server.cpp:1155-1176`), so the break lands at the last glyph
 * that fits, which is `AUTOWRAP_ARBITRARY`.
 */
function itemListAutowrapMode(iconMode: number, maxTextLines: number): EnumValue<typeof AutowrapMode> {
  return isItemListTextWrapped(iconMode, maxTextLines)
    ? AutowrapMode.AUTOWRAP_ARBITRARY
    : AutowrapMode.AUTOWRAP_OFF;
}

/** TOP mode with `max_text_lines > 0`: the only label Godot wraps (`item_list.cpp:49,1766`). */
export function isItemListTextWrapped(iconMode: number, maxTextLines: number): boolean {
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

/** An AUTO item draws its fill left to right, whatever direction its text infers. */
const IS_ITEM_DRAWN_RTL = isDrawnRtl(textBidiOptions(ITEM_BIDI, ''));

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

/**
 * Shapes one item's text at `widthPx`, or `null` for an item with none, as `TextParagraph::_shape_lines`
 * does (`text_paragraph.cpp:225-266`). A wrapped label shows `max_text_lines` lines, and when lines
 * hide, the last shown line ends in an ellipsis unless the behaviour is `OVERRUN_NO_TRIMMING`. A
 * single-line label trims that one line to the width.
 */
export function shapeItemListText(input: ItemTextShapeInput): TextLayoutResult | null {
  if (input.text.length === 0) return null;
  const wrapped = isItemListTextWrapped(input.iconMode, input.maxTextLines);
  const layout = shapeText(input.text, {
    ...textBidiOptions(ITEM_BIDI, input.locale),
    fontSizePx: input.fontSizePx,
    boxWidthPx: input.widthPx,
    autowrapMode: itemListAutowrapMode(input.iconMode, input.maxTextLines),
    breakMandatory: wrapped,
    // Zero: `force_update_list_size` adds a flat `line_separation * max_text_lines`
    // (`item_list.cpp:1772`), which `itemContentMinSize` adds.
    lineSpacingPx: 0,
    fontMetrics: input.fontMetrics,
  });
  const overrunFlags = overrunFlagsForBehavior(
    input.overrunBehavior ?? OverrunBehavior.OVERRUN_TRIM_ELLIPSIS
  );
  // `layout.fontMetrics`, not `input.fontMetrics`: `shapeText` defaults to the bundled face
  // when the caller passes none, and the trim must agree with the metrics that shaped these glyphs.
  const trim = (line: TextLineLayout, flags: OverrunTrimFlags) =>
    trimTextBufferLineToWidth(line, input.widthPx, flags, {
      fontMetrics: layout.fontMetrics,
      fontSizePx: input.fontSizePx,
      isDrawnRtl: IS_ITEM_DRAWN_RTL,
    });

  const lines = wrapped
    ? withHiddenLinesEllipsis(layout.lines, input.maxTextLines, (line) =>
        trim(line, { ...overrunFlags, enforceEllipsis: true })
      )
    : layout.lines.map((line) => trim(line, overrunFlags));
  return {
    ...layout,
    lines,
    widthPx: lines.reduce((max, l) => Math.max(max, l.widthPx), 0),
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

// --- Per-item minimum size --------------------------------------------------

interface ItemContentInput {
  hasIcon: boolean;
  iconSize: Vector2;
  hasText: boolean;
  /** The shaped text's own `{ widthPx: ceiled, heightPx }`: `shapedTextSizeWidthPx(layout.widthPx)`/`layout.heightPx`. */
  textSize: Vector2;
  iconMode: number;
  maxTextLines: number;
  fixedColumnWidth: number;
}

/**
 * The per-item minsize before the separations `itemMinimumSize` adds (`item_list.cpp:1743-1790`).
 * `icon_margin` (`:1754,1756`) joins only with both an icon and text.
 */
function itemContentMinSize(input: ItemContentInput, spacing: ItemListSpacing): Vector2 {
  let x = 0;
  let y = 0;

  if (input.hasIcon) {
    x = input.iconSize.x;
    y = input.iconSize.y;
    if (input.hasText) {
      if (input.iconMode === ICON_MODE_TOP) {
        y += spacing.iconMargin;
      } else {
        x += spacing.iconMargin;
      }
    }
  }

  if (input.hasText) {
    if (input.iconMode === ICON_MODE_TOP) {
      x = Math.max(x, input.textSize.x);
      if (input.maxTextLines > 0) {
        y += input.textSize.y + spacing.lineSeparation * input.maxTextLines;
      } else {
        y += input.textSize.y;
      }
    } else {
      y = Math.max(y, input.textSize.y);
      x += input.textSize.x;
    }
  }

  if (input.fixedColumnWidth > 0) x = input.fixedColumnWidth;
  return { x, y };
}

/**
 * `max_column_width` (`item_list.cpp:1786-1790`): the widest minimum width before `h_separation`
 * joins it. `sameColumnWidth` adds the separation back once (`:1826`), so the packer takes this,
 * not the widest `itemMinimumSize`.
 */
export function itemListMaxColumnWidth(itemSizes: readonly Vector2[], hSeparation: number): number {
  return itemSizes.reduce((max, size) => Math.max(max, size.x - Math.max(0, hSeparation)), 0);
}

/** The full per-item minsize, including h/v separation (`item_list.cpp:1789-1790`). */
export function itemMinimumSize(input: ItemContentInput, spacing: ItemListSpacing): Vector2 {
  const content = itemContentMinSize(input, spacing);
  return {
    x: content.x + Math.max(0, spacing.hSeparation),
    y: content.y + Math.max(0, spacing.vSeparation),
  };
}

// --- Row packing: force_update_list_size's phase 2 (item_list.cpp:1798-1912) -

interface ItemListPackInput {
  /** Per-item minsize, including h/v separation: `itemMinimumSize`'s own output. */
  itemSizes: readonly Vector2[];
  /** The widest item's own minsize.x, across every item (`item_list.cpp:1786`): only consumed when `sameColumnWidth`. */
  maxColumnWidth: number;
  sameColumnWidth: boolean;
  /** `<= 0` means unbounded (`item_list.cpp:1804-1807`). Godot's own class default is 1, not 0: callers pass `maxColumns ?? 1`. */
  maxColumns: number;
  /**
   * `size.x - panel_style->get_minimum_size().width` (`item_list.cpp:1798`). It is also the
   * horizontal page (`:1853`). The `:1799-1801` widening reads a scrollbar only `!wraparound_items`
   * uses, and that case never reads `fitSize`.
   */
  fitSize: number;
  /** The vertical scrollbar's minimum width (`scroll_bar_v_minwidth`, `item_list.cpp:1738`). */
  verticalBarMinWidth: number;
  /** `is_layout_rtl()`. */
  rtl: boolean;
  wraparoundItems: boolean;
  autoWidth: boolean;
  hSeparation: number;
  /** `MAX(0, rectSize.y - panelMinHeight)`: `Infinity` when no resolved rect exists (the minimum-size pass has none). */
  availableHeight: number;
}

interface ItemListPackedItem {
  /** Relative to the packed content origin: the caller adds `base_ofs` (`item_list.cpp:1429`, the panel's own offset minus scroll). */
  rect: Rect2;
  column: number;
}

interface ItemListPackResult {
  items: readonly ItemListPackedItem[];
  /** Row-separator Y positions, content-relative (`item_list.cpp:1840`). */
  separators: readonly number[];
  /** `max_w`: the packed content's own total width. */
  contentWidth: number;
  /** `ofs.y + max_h`, post row-height backfill: the packed content's own total height. */
  contentHeight: number;
  /** `current_columns` once the loop settles: a one-column list draws each row's background to the list's right edge (`item_list.cpp:1502-1504`). */
  columnCount: number;
  vertical: ItemListScrollRange;
  horizontal: ItemListScrollRange;
}

/** One scrollbar's `Range` after `force_update_list_size`; `visible` is its `show()` or `hide()` (`item_list.cpp:1877-1905`). */
export interface ItemListScrollRange {
  visible: boolean;
  min: number;
  max: number;
  page: number;
}

/**
 * `force_update_list_size`'s row-packing `while (true)` loop (`item_list.cpp:1809-1908`).
 * It ends: `current_columns` only falls (to `MAX(col, 1)`, `:1822`), and the
 * overflow branch needs `current_columns > 1` (`:1820`).
 */
export function packItemListRows(input: ItemListPackInput): ItemListPackResult {
  const n = input.itemSizes.length;
  let fitSize = input.fitSize;
  let currentColumns = input.maxColumns > 0 ? input.maxColumns : 0x7fffffff;

  for (;;) {
    let allFit = true;
    let ofsX = 0;
    let ofsY = 0;
    let col = 0;
    let maxW = 0;
    let maxH = 0;
    const sizes: Vector2[] = input.itemSizes.map((s) => ({ ...s }));
    const positions: Vector2[] = new Array(n);
    const columns: number[] = new Array(n);
    const separators: number[] = [];

    for (let i = 0; i < n; i++) {
      if (currentColumns > 1 && sizes[i]!.x + ofsX > fitSize && !input.autoWidth && input.wraparoundItems) {
        currentColumns = Math.max(col, 1);
        allFit = false;
        break;
      }

      if (input.sameColumnWidth) {
        sizes[i]!.x = input.maxColumnWidth + Math.max(0, input.hSeparation);
      }
      positions[i] = { x: ofsX, y: ofsY };
      columns[i] = col;

      maxH = Math.max(maxH, sizes[i]!.y);
      ofsX += sizes[i]!.x;
      maxW = Math.max(maxW, ofsX);

      col++;
      if (col === currentColumns) {
        if (i < n - 1) separators.push(ofsY + maxH);
        for (let j = i; j >= 0 && col > 0; j--, col--) sizes[j]!.y = maxH;
        ofsX = 0;
        ofsY += maxH;
        col = 0;
        maxH = 0;
      }
    }

    const verticalPage = Math.max(0, input.availableHeight);
    const verticalMax = Math.max(verticalPage, ofsY + maxH);
    const horizontalPage = Math.max(0, input.fitSize);
    const horizontalMax = input.wraparoundItems ? 0 : Math.max(horizontalPage, maxW);

    // Port the condition as written (`item_list.cpp:1862-1864`): the bar's width comes off on a
    // pass whose content fits, or under RTL, not on one that overflows.
    if (verticalPage >= verticalMax || input.rtl) fitSize -= input.verticalBarMinWidth;

    if (!allFit) continue;

    // Backfill the final (possibly partial) row's height (item_list.cpp:1866-1869).
    for (let j = n - 1; j >= 0 && col > 0; j--, col--) sizes[j]!.y = maxH;

    // RTL without wrap mirrors the horizontal range so its value 0 is the far end (`:1891-1893`).
    const mirrorsHorizontal = input.rtl && !input.wraparoundItems;
    const horizontal: ItemListScrollRange = {
      visible: horizontalMax > horizontalPage,
      min: mirrorsHorizontal ? -(horizontalMax - horizontalPage) : 0,
      max: mirrorsHorizontal ? horizontalPage : horizontalMax,
      page: horizontalPage,
    };

    return {
      items: positions.map((p, i) => ({
        rect: { x: p.x, y: p.y, w: sizes[i]!.x, h: sizes[i]!.y },
        column: columns[i]!,
      })),
      separators,
      contentWidth: maxW,
      contentHeight: ofsY + maxH,
      columnCount: currentColumns,
      vertical: { visible: verticalMax > verticalPage, min: 0, max: verticalMax, page: verticalPage },
      horizontal,
    };
  }
}

// --- Minimum size: ItemList::get_minimum_size (item_list.cpp:2136-2146) ----

/** Godot's own class default (`item_list.h:142`): callers pass this, not `?? 0`, when `maxColumns` is unset. */
export const ITEM_LIST_DEFAULT_MAX_COLUMNS = 1;

/**
 * Godot's `get_minimum_size()` reads `auto_width_value`/`auto_height_value` from the last draw,
 * converging over frames. The first solve pass packs at unbounded `fitSize` and `availableHeight`;
 * the second reads the first pass' rect (`tentativeRect`, `registerSizeDependentMinimum`), which
 * is the one frame of convergence that decides the scrollbar terms (`item_list.cpp:1883,1903`).
 */
const itemListMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ItemListRuntimeProperties;
  const items = props.items ?? [];

  const minSize = { x: 0, y: 0 };
  if (!props.autoWidth && !props.autoHeight) return minSize;

  const { fontSizePx } = itemListTextTheme(n, props);
  const fontMetrics = resolveNodeFontMetrics(n, ITEM_LIST_THEME_FONT_KEY);
  const iconMode = props.iconMode ?? ICON_MODE_LEFT;
  const maxTextLines = props.maxTextLines ?? 1;
  const fixedColumnWidth = props.fixedColumnWidth ?? 0;
  const iconScale = props.iconScale ?? 1;
  const spacing = itemListSpacing(n.constants);

  const itemSizes: Vector2[] = items.map((item, i) => {
    const hasIcon = itemHasIcon(item);
    const iconSize = itemIconPackedSize(
      hasIcon,
      n.textureSlots[itemListIconSlotKey(i)] ?? null,
      props.fixedIconSize,
      iconScale
    );
    const text = item.text ?? '';
    const hasText = text.length > 0;
    const layout =
      hasText && ctx.measureText
        ? shapeItemListText({
            text,
            fontSizePx,
            fontMetrics,
            iconMode,
            maxTextLines,
            widthPx: itemListMinimumShapeWidthPx(fixedColumnWidth),
            overrunBehavior: props.textOverrunBehavior,
            locale: n.locale,
          })
        : null;
    const textSize = layout
      ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
      : { x: 0, y: 0 };
    return itemMinimumSize(
      { hasIcon, iconSize, hasText, textSize, iconMode, maxTextLines, fixedColumnWidth },
      spacing
    );
  });

  const { hSeparation } = spacing;
  const maxColumnWidth = itemListMaxColumnWidth(itemSizes, hSeparation);
  const panelMin = contentMarginSize(requiredThemeItem(n.styleBoxes, 'panel'));
  const tentative = ctx.tentativeRect?.(n);
  const barMinimums = scrollBarThicknesses(internalScrollBarBoxes(n));
  const packed = packItemListRows({
    itemSizes,
    maxColumnWidth,
    sameColumnWidth: props.sameColumnWidth === true,
    maxColumns: props.maxColumns ?? ITEM_LIST_DEFAULT_MAX_COLUMNS,
    fitSize: tentative ? tentative.w - panelMin.x : Number.POSITIVE_INFINITY,
    verticalBarMinWidth: barMinimums.verticalWidth,
    rtl: n.rtl,
    wraparoundItems: props.wraparoundItems !== false,
    autoWidth: props.autoWidth === true,
    hSeparation,
    availableHeight: tentative ? Math.max(0, tentative.h - panelMin.y) : Number.POSITIVE_INFINITY,
  });

  if (props.autoWidth) {
    minSize.x = packed.contentWidth + panelMin.x + (packed.vertical.visible ? barMinimums.verticalWidth : 0);
  }
  if (props.autoHeight) {
    minSize.y =
      packed.contentHeight + panelMin.y + (packed.horizontal.visible ? barMinimums.horizontalHeight : 0);
  }
  return minSize;
};

controlSolverRegistry.registerMinimumSize('ItemList', itemListMinimumSize);
controlSolverRegistry.registerSizeDependentMinimum('ItemList');
controlSolverRegistry.registerTextureSlots('ItemList', itemListTextureSlots);

// --- Draw-time per-item geometry (item_list.cpp:1536-1691) ----------------

interface ItemIconDraw {
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

interface ItemListGuideLine {
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

// --- RTL draw geometry: item_list.cpp:1582-1584,1629-1641,1657-1668 -------

/**
 * Mirrors the icon rect (`item_list.cpp:1582-1584`) or the wrapped text box
 * (`:1639-1641`) inside `get_size().width`. The `!wraparound_items` widening by
 * `scroll_bar_h->get_max() - get_page()` (`:1438-1440`) is zero under RTL, which
 * sets that max to the page (`:1891-1893`).
 */
export function itemListMirrorX(ltrX: number, widthPx: number, controlWidthPx: number, rtl: boolean): number {
  return rtl ? controlWidthPx - ltrX - widthPx : ltrX;
}

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
