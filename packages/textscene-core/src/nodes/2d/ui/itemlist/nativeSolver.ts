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
import {
  ITEM_LIST_DEFAULT_MAX_COLUMNS,
  itemHasIcon,
  itemIconPackedSize,
  itemListMaxColumnWidth,
  itemListSpacing,
  itemMinimumSize,
  packItemListRows,
  type ItemListPackResult,
  type ItemListSpacing,
} from './itemListPack';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';

// --- Enum literals ------------------------------------------------------

/** `ItemList::IconMode` (`item_list.h:43-44`). */
const { ICON_MODE_LEFT } = ItemListIconMode;
export { ICON_MODE_LEFT };

// --- Theme font ----------------------------------------------------------

/** ItemList's own theme font key, `SceneStringName(font)`, which the default theme registers under ItemList. */
const ITEM_LIST_THEME_FONT_KEY = 'font';

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

/** `item_N/icon` (`item_list.cpp:2464`): one slot request per row that names an icon. */
const itemListTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as ItemListRuntimeProperties;
  const requests: TextureSlotRequest[] = [];
  (props.items ?? []).forEach((item, index) => {
    if (item.icon) requests.push({ key: itemListIconSlotKey(index), ref: item.icon });
  });
  return requests;
};

// --- The layout: force_update_list_size (item_list.cpp:1733-1912) ---------

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
const itemListContent = defineShare((n): ItemListContent => contentWith(n, shapedLabels));

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
