import type { ControlProperties } from '../control/types';

export interface GridContainerProperties extends ControlProperties {
  /** Number of columns in the grid (Godot default 1). */
  columns?: number;
}
