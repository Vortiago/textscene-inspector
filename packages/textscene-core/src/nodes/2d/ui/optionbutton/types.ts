/** OptionButton's parsed properties. */

import type { ButtonProperties } from '../button/types';

export interface OptionItem {
  /** Option label text. */
  text: string;
  /** Numeric option id, the array index when absent. */
  id: number;
  /** The item's raw Texture2D ref. The button shows the selected item's one as its `icon` (`option_button.cpp:424`). */
  icon?: string;
}

export interface OptionButtonProperties extends ButtonProperties {
  /** List of selectable items, built from popup/item_N/… keys. */
  items?: OptionItem[];
  /** Index into `items` of the selected option. Undefined means none. */
  selected?: number;
  /** `fit_to_longest_item`: the minimum size holds the longest item, not only the selected one. Godot default true (`option_button.h`). */
  fitToLongestItem?: boolean;
}
