import type { ControlProperties } from '../control/types';

export interface ColorRectProperties extends ControlProperties {
  /** Raw Godot `Color(r,g,b,a)` fill string. */
  color?: string;
}
