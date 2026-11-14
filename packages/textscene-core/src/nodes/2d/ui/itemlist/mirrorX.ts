/**
 * The one RTL mirror of an ItemList's draw: a box placed left to right, moved to the same distance
 * from the control's right edge.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/**
 * Mirrors the icon rect (`item_list.cpp:1582-1584`) or the wrapped text box
 * (`:1639-1641`) inside `get_size().width`. The `!wraparound_items` widening by
 * `scroll_bar_h->get_max() - get_page()` (`:1438-1440`) is zero under RTL, which
 * sets that max to the page (`:1891-1893`).
 */
export function itemListMirrorX(ltrX: number, widthPx: number, controlWidthPx: number, rtl: boolean): number {
  return rtl ? controlWidthPx - ltrX - widthPx : ltrX;
}
