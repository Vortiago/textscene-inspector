/** Tree property definitions — the subset a static preview draws. Rows are never serialised — see `parser.ts`'s own doc. */

import type { ControlProperties } from '../control/types';

export interface TreeProperties extends ControlProperties {
  /** The column count. Godot default 1. `Tree::set_columns` refuses below 1. */
  columns?: number;
  /** Draws the (always-empty-titled) header row. Godot default false. */
  columnTitlesVisible?: boolean;
}
