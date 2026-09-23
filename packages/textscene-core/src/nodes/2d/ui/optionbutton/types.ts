/** OptionButton's parsed properties. */

import type { ButtonProperties } from '../button/types';

export interface OptionItem {
  /** Option label text. */
  text: string;
  /** Numeric option id, the array index when absent. */
  id: number;
}

export interface OptionButtonProperties extends ButtonProperties {
  /** List of selectable items, built from popup/item_N/… keys. */
  items?: OptionItem[];
  /** Index into `items` of the selected option. Undefined means none. */
  selected?: number;
}
