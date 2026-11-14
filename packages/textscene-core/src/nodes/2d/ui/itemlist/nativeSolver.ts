/**
 * ItemList's layout: `ItemList::force_update_list_size` (`scene/gui/item_list.cpp:1733-1912`), its
 * per-item minsize (`:1743-1796`) and `get_minimum_size` (`:2136-2146`), as the shares that the
 * minimum size and the draw (`itemListDraw.ts`) both read. `comparison.md` lists what it leaves out.
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
import { defineRectShare, defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import type { Rect2 } from '../../../../godot/math/rect2';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { scrollBarThicknesses } from '../shared/scrollBarSolver';
import {
  isItemListTextWrapped,
  itemListMinimumShapeWidthPx,
  shapeItemListLine,
  shapeItemListText,
  trimItemListLine,
  type ItemTextShape,
} from './itemText';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';

// --- Enum literals ------------------------------------------------------

/** `ItemList::IconMode` (`item_list.h:43-44`). */
const { ICON_MODE_TOP, ICON_MODE_LEFT } = ItemListIconMode;
export { ICON_MODE_LEFT };

// --- Theme font ----------------------------------------------------------

/** ItemList's own theme font key, `SceneStringName(font)`, which the default theme registers under ItemList. */
export const ITEM_LIST_THEME_FONT_KEY = 'font';

const ITEM_LIST_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** Resolves ItemList's own theme font size/colour (overrides, else the ancestor Theme chain / theme default). */
export function itemListTextTheme(n: ShareNode, props: ItemListRuntimeProperties): ResolvedTextTheme {
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

export function itemListSpacing(constants: ShareNode['constants']): ItemListSpacing {
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

// --- The layout: force_update_list_size (item_list.cpp:1733-1912) ---------

/** Godot's own class default (`item_list.h:142`): callers pass this, not `?? 0`, when `maxColumns` is unset. */
export const ITEM_LIST_DEFAULT_MAX_COLUMNS = 1;

/** One item before the list's size places it. */
export interface ItemListRow {
  item: ItemListRuntimeItem;
  hasIcon: boolean;
  /** The icon's packed size (`itemIconPackedSize`): zero without an icon or before it loads. */
  iconSize: Vector2;
  /** The label at the minimum-size width (`item_list.cpp:1763-1766`). Null with no text, or with no measurer. */
  minimumLabel: TextLayoutResult | null;
  /** A single-line label before its trim, which the draw cuts to its own width. Null for a wrapped label. */
  untrimmedLine: TextLayoutResult | null;
  /** `itemMinimumSize`, with the separations. */
  minimumSize: Vector2;
}

/** Everything about the items that does not depend on the list's size. */
export interface ItemListContent {
  rows: readonly ItemListRow[];
  /** The shaping inputs of every label but its text and width. */
  textShape: Omit<ItemTextShape, 'text'>;
  spacing: ItemListSpacing;
  maxColumnWidth: number;
}

/** The list at one size: its content, packed. */
export interface ItemListLayout {
  content: ItemListContent;
  packed: ItemListPackResult;
  /** `panel_style->get_minimum_size()`, the panel's summed content margins. */
  panelMinimum: Vector2;
  bars: { verticalWidth: number; horizontalHeight: number };
}

interface ItemLabels {
  minimumLabel: TextLayoutResult | null;
  untrimmedLine: TextLayoutResult | null;
}

const NO_LABELS: ItemLabels = { minimumLabel: null, untrimmedLine: null };

/**
 * One shaping for each label: a single-line label is shaped once and trimmed to each width, and a
 * wrapped one is shaped at the minimum-size width.
 */
function shapedLabels(input: ItemTextShape, minimumWidthPx: number): ItemLabels {
  if (input.text.length === 0) return NO_LABELS;
  if (isItemListTextWrapped(input.iconMode, input.maxTextLines)) {
    return { minimumLabel: shapeItemListText({ ...input, widthPx: minimumWidthPx }), untrimmedLine: null };
  }
  const untrimmedLine = shapeItemListLine(input);
  return { minimumLabel: trimItemListLine(untrimmedLine, input, minimumWidthPx), untrimmedLine };
}

function itemListTextShape(n: ShareNode, props: ItemListRuntimeProperties): Omit<ItemTextShape, 'text'> {
  return {
    fontSizePx: itemListTextTheme(n, props).fontSizePx,
    fontMetrics: resolveNodeFontMetrics(n, ITEM_LIST_THEME_FONT_KEY),
    iconMode: props.iconMode ?? ICON_MODE_LEFT,
    maxTextLines: props.maxTextLines ?? 1,
    overrunBehavior: props.textOverrunBehavior,
    locale: n.locale,
  };
}

function rowOf(
  n: ShareNode,
  props: ItemListRuntimeProperties,
  item: ItemListRuntimeItem,
  index: number,
  labels: ItemLabels,
  spacing: ItemListSpacing
): ItemListRow {
  const hasIcon = itemHasIcon(item);
  const naturalIconSize = n.textureSlots[itemListIconSlotKey(index)] ?? null;
  const iconSize = itemIconPackedSize(hasIcon, naturalIconSize, props.fixedIconSize, props.iconScale ?? 1);
  const label = labels.minimumLabel;
  const textSize = label ? { x: shapedTextSizeWidthPx(label.widthPx), y: label.heightPx } : VECTOR2_ZERO;
  const minimumSize = itemMinimumSize(
    {
      hasIcon,
      iconSize,
      hasText: (item.text ?? '').length > 0,
      textSize,
      iconMode: props.iconMode ?? ICON_MODE_LEFT,
      maxTextLines: props.maxTextLines ?? 1,
      fixedColumnWidth: props.fixedColumnWidth ?? 0,
    },
    spacing
  );
  return { item, hasIcon, iconSize, ...labels, minimumSize };
}

/** The content, with each label shaped by `labelsOf`. */
function contentWith(
  n: ShareNode,
  labelsOf: (input: ItemTextShape, minimumWidthPx: number) => ItemLabels
): ItemListContent {
  const props = n.node.properties as ItemListRuntimeProperties;
  const spacing = itemListSpacing(n.constants);
  const textShape = itemListTextShape(n, props);
  const minimumWidthPx = itemListMinimumShapeWidthPx(props.fixedColumnWidth ?? 0);
  const rows = (props.items ?? []).map((item, index) =>
    rowOf(n, props, item, index, labelsOf({ ...textShape, text: item.text ?? '' }, minimumWidthPx), spacing)
  );
  const sizes = rows.map((row) => row.minimumSize);
  return { rows, textShape, spacing, maxColumnWidth: itemListMaxColumnWidth(sizes, spacing.hSeparation) };
}

/** The content with every label shaped once. */
export const itemListContent = defineShare((n): ItemListContent => contentWith(n, shapedLabels));

/** The content before a text measurer is ready: a label then has no size, as it has no glyphs. */
function unmeasuredContent(n: ShareNode): ItemListContent {
  return contentWith(n, () => NO_LABELS);
}

/** The list packed at `size`, its Control's size. An `Infinity` component packs unbounded on that axis. */
function layoutAt(n: ShareNode, size: Vector2, content: ItemListContent): ItemListLayout {
  const props = n.node.properties as ItemListRuntimeProperties;
  const panelMinimum = contentMarginSize(requiredThemeItem(n.styleBoxes, 'panel'));
  const bars = scrollBarThicknesses(internalScrollBarBoxes(n));
  const packed = packItemListRows({
    itemSizes: content.rows.map((row) => row.minimumSize),
    maxColumnWidth: content.maxColumnWidth,
    sameColumnWidth: props.sameColumnWidth === true,
    maxColumns: props.maxColumns ?? ITEM_LIST_DEFAULT_MAX_COLUMNS,
    fitSize: size.x - panelMinimum.x,
    verticalBarMinWidth: bars.verticalWidth,
    rtl: n.rtl,
    wraparoundItems: props.wraparoundItems !== false,
    autoWidth: props.autoWidth === true,
    hSeparation: content.spacing.hSeparation,
    availableHeight: Math.max(0, size.y - panelMinimum.y),
  });
  return { content, packed, panelMinimum, bars };
}

/** The list at its size, which its minimum size and its painter both read. */
export const itemListLayout = defineRectShare((n, size, theme) =>
  layoutAt(n, size, itemListContent(n, theme))
);

// --- Minimum size: ItemList::get_minimum_size (item_list.cpp:2136-2146) ----

const UNBOUNDED: Vector2 = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };

function minimumOf(layout: ItemListLayout, props: ItemListRuntimeProperties): Vector2 {
  const { packed, panelMinimum, bars } = layout;
  return {
    x: props.autoWidth
      ? packed.contentWidth + panelMinimum.x + (packed.vertical.visible ? bars.verticalWidth : 0)
      : 0,
    y: props.autoHeight
      ? packed.contentHeight + panelMinimum.y + (packed.horizontal.visible ? bars.horizontalHeight : 0)
      : 0,
  };
}

/**
 * Godot's `get_minimum_size()` reads `auto_width_value`/`auto_height_value` from the last draw,
 * converging over frames. The first solve pass packs unbounded, and the second packs at the first
 * pass' rect (`tentativeRect`, `registerSizeDependentMinimum`), which is the one frame of
 * convergence that decides the scrollbar terms (`item_list.cpp:1883,1903`).
 */
const itemListMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ItemListRuntimeProperties;
  if (!props.autoWidth && !props.autoHeight) return { x: 0, y: 0 };
  const tentative = ctx.tentativeRect?.(n);
  const size = tentative ? { x: tentative.w, y: tentative.h } : UNBOUNDED;
  const layout = ctx.measureText
    ? itemListLayout(n, size, ctx.theme)
    : layoutAt(n, size, unmeasuredContent(n));
  return minimumOf(layout, props);
};

controlSolverRegistry.registerMinimumSize('ItemList', itemListMinimumSize);
controlSolverRegistry.registerSizeDependentMinimum('ItemList');
controlSolverRegistry.registerTextureSlots('ItemList', itemListTextureSlots);
