/** OptionButton property definitions. */

import type { ControlProperties } from '../control/types';

export interface OptionItem {
  /** Option label text. */
  text: string;
  /** Numeric option id (defaults to array index if absent). */
  id: number;
}

export interface OptionButtonProperties extends ControlProperties {
  /** List of selectable items, built from popup/item_N/… keys. */
  items?: OptionItem[];
  /** Index into `items` of the currently selected option (undefined = none). */
  selected?: number;
  /** Disabled OptionButtons render dimmed and non-interactive. */
  disabled?: boolean;
  /** `Button::flat` — inherited: the chrome StyleBox is not drawn (`button.cpp:216`). */
  flat?: boolean;
}
