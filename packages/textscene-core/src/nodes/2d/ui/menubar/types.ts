import type { ControlProperties } from '../control/types';
import type { TextDirectionProperties } from '../../../../godot/text/paragraphDirection';

export interface MenuBarProperties extends ControlProperties, TextDirectionProperties {
  /** Drops the per-title StyleBox chrome when true. Default false (menu_bar.cpp:825-830). */
  flat?: boolean;
}
