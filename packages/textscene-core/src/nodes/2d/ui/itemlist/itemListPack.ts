/**
 * The steps of `ItemList::force_update_list_size` (`scene/gui/item_list.cpp:1733-1912`): each
 * item's minimum size (`:1743-1796`) and the loop that packs the items into rows (`:1798-1912`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import type { ShareNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { ItemListRuntimeItem } from './types';

const { ICON_MODE_TOP } = ItemListIconMode;

/** True for a row that names an icon by `item_N/icon` or, in a dialog, by theme icon. */
export function itemHasIcon(item: ItemListRuntimeItem): boolean {
  return item.icon !== undefined || item.themedIcon !== undefined;
}

/** Godot's own class default (`item_list.h:142`): callers pass this, not `?? 0`, when `maxColumns` is unset. */
export const ITEM_LIST_DEFAULT_MAX_COLUMNS = 1;

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

/** `fixed_icon_size` with both sides above 0: the only size that replaces an icon's own (`item_list.cpp:1746-1750`). */
export function hasFixedIconSize(fixedIconSize: Vector2 | undefined): fixedIconSize is Vector2 {
  return !!fixedIconSize && fixedIconSize.x > 0 && fixedIconSize.y > 0;
}

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
  if (hasFixedIconSize(fixedIconSize)) {
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

export interface ItemListPackResult {
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
