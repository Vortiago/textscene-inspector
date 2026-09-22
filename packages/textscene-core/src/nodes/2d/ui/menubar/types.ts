import type { ControlProperties } from '../control/types';

export interface MenuBarProperties extends ControlProperties {
  /** Drops the per-title StyleBox chrome when true. Default false (menu_bar.cpp:825-830). */
  flat?: boolean;
}
