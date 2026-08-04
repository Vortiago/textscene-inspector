/** OptionButton property definitions. */

import type { ButtonProperties } from '../button/types';

export interface OptionItem {
  /** Option label text. */
  text: string;
  /** Numeric option id (defaults to array index if absent). */
  id: number;
}

export interface OptionButtonProperties extends ButtonProperties {
  /** List of selectable items, built from popup/item_N/… keys. */
  items?: OptionItem[];
  /** Index into `items` of the currently selected option (undefined = none). */
  selected?: number;
}
