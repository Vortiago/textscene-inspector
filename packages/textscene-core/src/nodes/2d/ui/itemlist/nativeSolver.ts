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
  type SolveContext,
  type TextureSlotRequest,
  type TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { DEFAULT_FONT_SIZE } from '../../../../r3f/controls/godotDefaultTheme';
import { STYLE_FILL } from '../../../../r3f/controls/godotDefaultTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { OverrunBehavior, overrunFlagsForBehavior, trimLineToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import {
  shapeText,
  shapedTextSizeWidthPx,
  AutowrapMode,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { ItemListProperties } from './types';

// --- Enum literals ------------------------------------------------------

/** `ItemList::IconMode` (`item_list.h:43-44`). */
export const ICON_MODE_TOP = 0;
export const ICON_MODE_LEFT = 1;

// --- Theme font ----------------------------------------------------------

/** ItemList's own theme font key: `SceneStringName(font)` (`default_theme.cpp:951`). */
export const ITEM_LIST_THEME_FONT_KEY = 'font';

/** `control_font_lower_color` (`default_theme.cpp:103`): ItemList's own `font_color` default (`:954`). */
export const ITEM_LIST_DEFAULT_FONT_COLOR: ControlColor = { r: 0.65, g: 0.65, b: 0.65, a: 1 };

const ITEM_LIST_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** Resolves ItemList's own theme font size/colour (overrides, else the ancestor Theme chain / theme default). */
export function itemListTextTheme(
  n: SolveNode,
  props: ItemListProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: ITEM_LIST_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, ITEM_LIST_THEME_KEYS, defaults);
}

// --- Texture slots: one per item icon ------------------------------------

/** The `SolveNode.textureSlots` key for row `index`'s own icon. */
export function itemListIconSlotKey(index: number): string {
  return `item_${index}`;
}

/** `item_N/icon` (`item_list.cpp:2464`): one slot request per row that names an icon. */
export const itemListTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as ItemListProperties;
  const requests: TextureSlotRequest[] = [];
  (props.items ?? []).forEach((item, index) => {
    if (item.icon) requests.push({ key: itemListIconSlotKey(index), ref: item.icon });
  });
  return requests;
};

// --- Theme constants not exposed on NativeTheme ---------------------------

/**
 * Reconstructs the project's `gui/theme/default_theme_scale` from `theme.fontSize`:
 * see `spinbox/nativeSolver.ts` / `progressbar/nativeSolver.ts`'s own copy
 * of this same technique; `nativeTheme.ts` cannot be extended from this slice.
 */
function reconstructThemeScale(theme: Pick<NativeTheme, 'fontSize'>): number {
  return theme.fontSize / DEFAULT_FONT_SIZE;
}

/** `default_theme.cpp:949`: `theme->set_constant(line_separation, "ItemList", round(2*scale))`. */
const ITEM_LIST_LINE_SEPARATION_BASE = 2;

export function itemListLineSeparation(theme: Pick<NativeTheme, 'fontSize'>): number {
  return Math.round(ITEM_LIST_LINE_SEPARATION_BASE * reconstructThemeScale(theme));
}

/**
 * `h_separation`/`v_separation`/`icon_margin` (`default_theme.cpp:946-948`)
 * are all `Math::round(4 * scale)`: the identical formula `theme.separation`
 * (BoxContainer's own constant) already computes, so this reuses it rather
 * than re-deriving a third `round(4*scale)`.
 */
export function itemListSeparation(theme: Pick<NativeTheme, 'separation'>): number {
  return theme.separation;
}

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
/** `StyleBoxFlat`'s own unset default (`style_box_flat.h:40`). */
const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

/** `theme->set_stylebox(panel, "ItemList", make_flat_stylebox(style_normal_color))` (`default_theme.cpp:944`): every `make_flat_stylebox` default (margin 4, corner radius 3), both scaled. */
export function itemListPanelStyleBox(theme: Pick<NativeTheme, 'contentMargin' | 'cornerRadius'>): StyleBoxFlatData {
  const m = theme.contentMargin;
  return {
    bgColor: STYLE_FILL.normal,
    borderColor: DEFAULT_BORDER_COLOR,
    borderWidth: ZERO_SIDES,
    cornerRadius: {
      topLeft: theme.cornerRadius,
      topRight: theme.cornerRadius,
      bottomRight: theme.cornerRadius,
      bottomLeft: theme.cornerRadius,
    },
    expandMargin: ZERO_SIDES,
    contentMargin: { left: m, top: m, right: m, bottom: m },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/** This node's own `theme_override_styles/panel` if authored, else the default box. */
export function pickItemListPanelStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  theme: Pick<NativeTheme, 'contentMargin' | 'cornerRadius'>
): StyleBoxFlatData {
  return overrides.panel ?? itemListPanelStyleBox(theme);
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
  naturalSize: Vec2 | null,
  fixedIconSize: Vec2 | undefined,
  iconScale: number
): Vec2 {
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
export function adjustToMaxSize(size: Vec2, maxSize: Vec2): Rect2 {
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
 * `_shape_text` (`item_list.cpp:37-55`): TOP icon mode with `max_text_lines > 0`
 * wraps at word, grapheme and mandatory breaks; else one line. The text engine
 * has only `AutowrapMode.WORD`, so an unbreakable word overflows its column where
 * Godot breaks it mid-word (`comparison.md`).
 */
export function itemListAutowrapMode(iconMode: number, maxTextLines: number): AutowrapMode {
  return iconMode === ICON_MODE_TOP && maxTextLines > 0 ? AutowrapMode.WORD : AutowrapMode.OFF;
}

/**
 * The width `text_buf->set_width()` is called with during the MINSIZE pass
 * (`item_list.cpp:1763-1766`): `fixed_column_width` when set, else
 * unconstrained (Godot's `-1`, this engine's `0`). Text is not shaped again at the
 * final column width (`item_list.cpp:1628-1634,1657-1661`), so a wider fitted column is approximate.
 */
export function itemListShapeWidth(fixedColumnWidth: number): number {
  return fixedColumnWidth > 0 ? fixedColumnWidth : 0;
}

export interface ItemTextShapeInput {
  text: string;
  fontSizePx: number;
  fontMetrics: Parameters<typeof shapeText>[1]['fontMetrics'];
  iconMode: number;
  maxTextLines: number;
  fixedColumnWidth: number;
  /** `TextServer::OverrunBehavior`. Godot default 3 (OVERRUN_TRIM_ELLIPSIS, `item_list.h:131`). */
  overrunBehavior?: number;
}

/**
 * Shapes one item's text, or `null` for an item with none. The minsize pass
 * (`item_list.cpp:1763-1766`) and the draw pass (`:1621-1661`) both read the
 * trimmed size after `text_buf->set_width`, so the overrun trim applies here, to
 * each line, as `TextParagraph::_shape_lines` does (`text_paragraph.cpp:257-270`).
 */
export function shapeItemListText(input: ItemTextShapeInput): TextLayoutResult | null {
  if (input.text.length === 0) return null;
  const widthPx = itemListShapeWidth(input.fixedColumnWidth);
  const layout = shapeText(input.text, {
    fontSizePx: input.fontSizePx,
    boxWidthPx: widthPx,
    autowrapMode: itemListAutowrapMode(input.iconMode, input.maxTextLines),
    lineSpacingPx: itemListLineSeparationForShaping(input),
    fontMetrics: input.fontMetrics,
  });
  const overrunFlags = overrunFlagsForBehavior(input.overrunBehavior ?? OverrunBehavior.TRIM_ELLIPSIS);
  if (!overrunFlags.trim || widthPx <= 0) return layout;

  const trimmedLines = layout.lines.map((line) =>
    // `layout.fontMetrics`, not `input.fontMetrics`: `shapeText` defaults to
    // the vendored atlas font when the caller passes none, and the trim must
    // agree with whichever metrics actually shaped these glyphs.
    trimLineToWidth(line, widthPx, overrunFlags, { fontMetrics: layout.fontMetrics, fontSizePx: input.fontSizePx })
  );
  return {
    ...layout,
    lines: trimmedLines,
    widthPx: trimmedLines.reduce((max, l) => Math.max(max, l.widthPx), 0),
  };
}

/**
 * Zero: `shapeText` spaces between lines, but `force_update_list_size`
 * (`item_list.cpp:1772`) adds a flat `line_separation * max_text_lines`, which
 * `itemContentMinSize` adds.
 */
function itemListLineSeparationForShaping(_input: ItemTextShapeInput): number {
  return 0;
}

// --- Per-item minimum size --------------------------------------------------

export interface ItemContentInput {
  hasIcon: boolean;
  iconSize: Vec2;
  hasText: boolean;
  /** The shaped text's own `{ widthPx: ceiled, heightPx }`: `shapedTextSizeWidthPx(layout.widthPx)`/`layout.heightPx`. */
  textSize: Vec2;
  iconMode: number;
  maxTextLines: number;
  fixedColumnWidth: number;
}

/**
 * The per-item minsize before the separations `itemMinimumSize` adds
 * (`item_list.cpp:1743-1790`). `icon_margin` (item_list.cpp:1754,1756) is the same
 * `round(4*scale)` as `h_separation`/`v_separation`, added only with both an icon and text.
 */
export function itemContentMinSize(
  input: ItemContentInput,
  theme: Pick<NativeTheme, 'fontSize' | 'separation'>
): Vec2 {
  let x = 0;
  let y = 0;

  if (input.hasIcon) {
    x = input.iconSize.x;
    y = input.iconSize.y;
    if (input.hasText) {
      if (input.iconMode === ICON_MODE_TOP) {
        y += itemListSeparation(theme);
      } else {
        x += itemListSeparation(theme);
      }
    }
  }

  if (input.hasText) {
    if (input.iconMode === ICON_MODE_TOP) {
      x = Math.max(x, input.textSize.x);
      if (input.maxTextLines > 0) {
        y += input.textSize.y + itemListLineSeparation(theme) * input.maxTextLines;
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

/** The full per-item minsize, including h/v separation (`item_list.cpp:1789-1790`). */
export function itemMinimumSize(
  input: ItemContentInput,
  theme: Pick<NativeTheme, 'fontSize' | 'separation'>
): Vec2 {
  const content = itemContentMinSize(input, theme);
  const sep = itemListSeparation(theme);
  return { x: content.x + Math.max(0, sep), y: content.y + Math.max(0, sep) };
}

// --- Row packing: force_update_list_size's phase 2 (item_list.cpp:1798-1912) -

export interface ItemListPackInput {
  /** Per-item minsize, including h/v separation: `itemMinimumSize`'s own output. */
  itemSizes: readonly Vec2[];
  /** The widest item's own minsize.x, across every item (`item_list.cpp:1786`): only consumed when `sameColumnWidth`. */
  maxColumnWidth: number;
  sameColumnWidth: boolean;
  /** `<= 0` means unbounded (`item_list.cpp:1804-1807`). Godot's own class default is 1, not 0: callers pass `maxColumns ?? 1`. */
  maxColumns: number;
  /**
   * `size.x - panel_style->get_minimum_size().width` (`item_list.cpp:1798`), without the unported
   * scrollbar adjustment (`:1798-1801,1862-1864`). Only a pass with more than one column,
   * `wraparound_items` and no `auto_width` reads it.
   */
  fitSize: number;
  wraparoundItems: boolean;
  autoWidth: boolean;
  hSeparation: number;
  /** `MAX(0, rectSize.y - panelMinHeight)`: `Infinity` when no resolved rect exists (the minimum-size pass has none). */
  availableHeight: number;
}

export interface ItemListPackedItem {
  /** Relative to the packed content origin: the caller adds `base_ofs` (`item_list.cpp:1429`, the panel's own offset minus scroll). */
  rect: Rect2;
  column: number;
}

export interface ItemListPackResult {
  items: readonly ItemListPackedItem[];
  /** Row-separator Y positions, content-relative (`item_list.cpp:1840`). */
  separators: readonly number[];
  /** `max_w`: the packed content's own total width. */
  contentWidth: number;
  /** `ofs.y + max_h`, post row-height backfill: the packed content's own total height. */
  contentHeight: number;
  /** `scroll_bar_v_max > scroll_bar_v_page` (`item_list.cpp:1877-1889`): informational; this codebase draws no scrollbar. */
  verticalScrollbarVisible: boolean;
}

/**
 * `force_update_list_size`'s row-packing `while (true)` loop (`item_list.cpp:1809-1908`).
 * It ends: `current_columns` only falls (to `MAX(col, 1)`, `:1822`), and the
 * overflow branch needs `current_columns > 1` (`:1820`).
 */
export function packItemListRows(input: ItemListPackInput): ItemListPackResult {
  const n = input.itemSizes.length;
  let currentColumns = input.maxColumns > 0 ? input.maxColumns : 0x7fffffff;

  for (;;) {
    let allFit = true;
    let ofsX = 0;
    let ofsY = 0;
    let col = 0;
    let maxW = 0;
    let maxH = 0;
    const sizes: Vec2[] = input.itemSizes.map((s) => ({ ...s }));
    const positions: Vec2[] = new Array(n);
    const columns: number[] = new Array(n);
    const separators: number[] = [];

    for (let i = 0; i < n; i++) {
      if (currentColumns > 1 && sizes[i]!.x + ofsX > input.fitSize && !input.autoWidth && input.wraparoundItems) {
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

    if (!allFit) continue;

    // Backfill the final (possibly partial) row's height (item_list.cpp:1866-1869).
    for (let j = n - 1; j >= 0 && col > 0; j--, col--) sizes[j]!.y = maxH;

    const page = Math.max(0, input.availableHeight);
    const max = Math.max(page, ofsY + maxH);

    return {
      items: positions.map((p, i) => ({
        rect: { x: p.x, y: p.y, w: sizes[i]!.x, h: sizes[i]!.y },
        column: columns[i]!,
      })),
      separators,
      contentWidth: maxW,
      contentHeight: ofsY + maxH,
      verticalScrollbarVisible: max > page,
    };
  }
}

// --- Minimum size: ItemList::get_minimum_size (item_list.cpp:2136-2146) ----

/** Godot's own class default (`item_list.h:142`): callers pass this, not `?? 0`, when `maxColumns` is unset. */
export const ITEM_LIST_DEFAULT_MAX_COLUMNS = 1;

/**
 * Godot's `get_minimum_size()` reads `auto_width_value`/`auto_height_value` from
 * the last draw, converging over frames; `SolveContext` solves once, so this packs
 * once with infinite `fitSize` and `availableHeight`. Exact under `auto_width` or
 * `max_columns > 0`; approximate for `auto_height` with `max_columns` 0 and no `auto_width`.
 */
export const itemListMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ItemListProperties;
  const items = props.items ?? [];

  const minSize = { x: 0, y: 0 };
  if (!props.autoWidth && !props.autoHeight) return minSize;

  const { fontSizePx } = itemListTextTheme(n, props, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, ITEM_LIST_THEME_FONT_KEY);
  const iconMode = props.iconMode ?? ICON_MODE_LEFT;
  const maxTextLines = props.maxTextLines ?? 1;
  const fixedColumnWidth = props.fixedColumnWidth ?? 0;
  const iconScale = props.iconScale ?? 1;

  const itemSizes: Vec2[] = items.map((item, i) => {
    const hasIcon = item.icon !== undefined;
    const iconSize = itemIconPackedSize(hasIcon, n.textureSlots[itemListIconSlotKey(i)] ?? null, props.fixedIconSize, iconScale);
    const text = item.text ?? '';
    const hasText = text.length > 0;
    const layout =
      hasText && ctx.measureText
        ? shapeItemListText({ text, fontSizePx, fontMetrics, iconMode, maxTextLines, fixedColumnWidth, overrunBehavior: props.textOverrunBehavior })
        : null;
    const textSize = layout ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx } : { x: 0, y: 0 };
    return itemMinimumSize({ hasIcon, iconSize, hasText, textSize, iconMode, maxTextLines, fixedColumnWidth }, ctx.theme);
  });

  const maxColumnWidth = itemSizes.reduce((max, s) => Math.max(max, s.x), 0);
  const packed = packItemListRows({
    itemSizes,
    maxColumnWidth,
    sameColumnWidth: props.sameColumnWidth === true,
    maxColumns: props.maxColumns ?? ITEM_LIST_DEFAULT_MAX_COLUMNS,
    fitSize: Number.POSITIVE_INFINITY,
    wraparoundItems: props.wraparoundItems !== false,
    autoWidth: props.autoWidth === true,
    hSeparation: itemListSeparation(ctx.theme),
    availableHeight: Number.POSITIVE_INFINITY,
  });

  const panelBox = pickItemListPanelStyleBox(n.styleBoxes, ctx.theme);
  const panelMin = contentMarginSize(panelBox);

  if (props.autoWidth) minSize.x = packed.contentWidth + panelMin.x;
  if (props.autoHeight) minSize.y = packed.contentHeight + panelMin.y;
  return minSize;
};

controlSolverRegistry.registerMinimumSize('ItemList', itemListMinimumSize);
controlSolverRegistry.registerTextureSlots('ItemList', itemListTextureSlots);

// --- Draw-time per-item geometry (item_list.cpp:1536-1691) ----------------

export interface ItemIconDraw {
  /** Relative to the item's own rect origin. `null` when the item has no icon. */
  rect: Rect2 | null;
  /** `icon_size.height + icon_margin` (TOP) or `icon_size.width + icon_margin` (LEFT): the pen offset the text inherits. */
  textOffsetContribution: Vec2;
}

/**
 * `item_list.cpp:1536-1566,1573-1585`. `icon_region` and `icon_transposed` are no
 * `PropertyListHelper` leaf, so the region is the full icon and nothing transposes.
 */
export function itemIconDraw(
  hasIcon: boolean,
  iconMode: number,
  packedIconSize: Vec2,
  naturalSize: Vec2 | null,
  fixedIconSizeSet: boolean,
  itemRectSize: Vec2,
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
    iconMode === ICON_MODE_TOP ? { x: 0, y: packedIconSize.y + iconMargin } : { x: packedIconSize.x + iconMargin, y: 0 };

  return { rect, textOffsetContribution };
}

/**
 * `item_list.cpp:1606-1691`'s LTR pen origin, before the RTL branches
 * (`itemListRowTextX`/`itemListMirrorX`) move it. TOP mode centres
 * (`HORIZONTAL_ALIGNMENT_CENTER`); LEFT mode is a single line, aligned LEFT
 * under LTR and RIGHT under RTL (`:1668,1670`).
 */
export function itemTextDrawOffset(
  iconMode: number,
  iconOffset: Vec2,
  itemRectSize: Vec2,
  textLineHeightTotal: number,
  hSeparation: number,
  vSeparation: number
): Vec2 {
  if (iconMode === ICON_MODE_TOP) {
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

/** One line's own horizontal offset under `HORIZONTAL_ALIGNMENT_CENTER` (TOP icon mode only: LEFT mode never centres, `_shape_text`'s own alignment call site). */
export function itemTextLineCenterOffset(centerWidth: number, lineWidthCeiled: number): number {
  return Math.max(0, centerWidth - lineWidthCeiled) / 2;
}

// --- Per-item colour: item_list.cpp:1568-1571,1607-1622, minus selected/hovered ---

/** `icon_modulate` is a real `Item` member but never a `PropertyListHelper` leaf, so it is always its class default `Color(1,1,1,1)` (`item_list.h:68`), dimmed on `disabled` (`item_list.cpp:1569-1571`). */
export function itemIconColor(disabled: boolean): ControlColor {
  return { r: 1, g: 1, b: 1, a: disabled ? 0.5 : 1 };
}

/** `custom_fg` is likewise never authorable, so `txt_modulate` always resolves to `font_color`, dimmed on `disabled` (`item_list.cpp:1614-1622`). */
export function itemTextColor(baseColor: ControlColor, disabled: boolean): ControlColor {
  return disabled ? { ...baseColor, a: baseColor.a * 0.5 } : baseColor;
}

// --- Row/column guide lines: item_list.cpp:1446-1459 -----------------------

/** `default_theme.cpp:959`: `theme->set_color("guide_color", "ItemList", Color(0.7, 0.7, 0.7, 0.25))`. */
export const ITEM_LIST_DEFAULT_GUIDE_COLOR: ControlColor = { r: 0.7, g: 0.7, b: 0.7, a: 0.25 };

/** This node's own `theme_override_colors/guide_color` (already folded onto `n.colors` by the walker), else the built-in default. */
export function itemListGuideColor(n: Pick<SolveNode, 'colors'>): ControlColor {
  return n.colors.guide_color ?? ITEM_LIST_DEFAULT_GUIDE_COLOR;
}

export interface ItemListGuideLine {
  /** Content-relative Y: the caller adds the panel's own offset (`origin`, `item_list.cpp:1429`). */
  y: number;
  /** Spans the panel's own content width, from its content origin (`item_list.cpp:1455-1457`). */
  width: number;
}

/**
 * `item_list.cpp:1446-1459`'s separator draw without the scroll clip: nothing is
 * scrolled out of view. RTL moves a separator only while the vertical scrollbar
 * shows (`:1454-1458`), and none is drawn, so both directions share one span.
 */
export function itemListGuideLines(iconMode: number, separators: readonly number[], contentWidth: number): ItemListGuideLine[] {
  if (iconMode === ICON_MODE_TOP) return [];
  return separators.map((y) => ({ y, width: contentWidth }));
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

export interface ItemListRowTextXInput {
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
    input.controlWidthPx - input.itemRectWidthPx + input.iconWidthPx - input.ltrX + Math.max(input.hSeparation, 0);
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

/**
 * `HORIZONTAL_ALIGNMENT_RIGHT`'s own per-line shift, `width - line_width`,
 * applied only while the box has a positive width
 * (`TextParagraph::draw`, `text_paragraph.cpp:888,916-921`). `lineWidthPx`
 * is the raw pen extent (`shaped_text_get_width`), never the ceiled size.
 */
export function itemListRightAlignOffsetPx(textWidthPx: number, lineWidthPx: number): number {
  return textWidthPx > 0 ? textWidthPx - lineWidthPx : 0;
}
