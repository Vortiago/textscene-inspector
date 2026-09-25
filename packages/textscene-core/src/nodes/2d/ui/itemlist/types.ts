/** ItemList property definitions: Control plus ItemList's own members and its `item_N/*` family. */

import type { ControlProperties } from '../control/types';

/**
 * One row's four serialised leaves (`item_list.cpp:2463-2466`). `tooltip`,
 * `custom_bg_color`, `icon_modulate` and the rest are not registered on
 * `base_property_helper`, so they never reach a `.tscn`.
 */
export interface ItemListItem {
  /** `item_N/text`. Godot default "". */
  text?: string;
  /** `item_N/icon`: the raw resource-reference text (`ExtResource(...)`/`SubResource(...)`), resolved at paint time like Button's `icon`. */
  icon?: string;
  /** `item_N/selectable`. Godot default true. */
  selectable?: boolean;
  /** `item_N/disabled`. Godot default false. */
  disabled?: boolean;
}

export interface ItemListProperties extends ControlProperties {
  /** `ItemList::SelectMode`. Godot default 0 (SELECT_SINGLE). */
  selectMode?: number;
  /** `ItemList::IconMode`. Godot default 1 (ICON_MODE_LEFT, `item_list.h:128`). */
  iconMode?: number;
  /** `ItemList::ScrollHintMode`. Godot default 0 (DISABLED). */
  scrollHintMode?: number;
  allowReselect?: boolean;
  allowRmbSelect?: boolean;
  /** Godot default true. */
  allowSearch?: boolean;
  autoWidth?: boolean;
  autoHeight?: boolean;
  /** Godot default true. */
  wraparoundItems?: boolean;
  tileScrollHint?: boolean;
  sameColumnWidth?: boolean;
  /** Godot default 1. */
  maxTextLines?: number;
  /** The real serialised row count (`ADD_ARRAY_COUNT`). Godot default 0. */
  itemCount?: number;
  /** Godot default 1. */
  maxColumns?: number;
  /** Godot default 0 (no fixed width). */
  fixedColumnWidth?: number;
  /** Godot default 1.0. */
  iconScale?: number;
  /** Godot default `Size2()` (no fixed size). */
  fixedIconSize?: { x: number; y: number };
  /** `TextServer::OverrunBehavior`. Godot default 3 (OVERRUN_TRIM_ELLIPSIS). */
  textOverrunBehavior?: number;
  /** Rows 0..`itemCount-1`, dense: `items[i]` is `{}` for an index no `item_i/*` key names. */
  items: ItemListItem[];
}
