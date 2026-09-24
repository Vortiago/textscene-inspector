import type { ControlProperties } from '../control/types';

export interface TextureRectProperties extends ControlProperties {
  /** Raw `texture` ref (for example `ExtResource("id")` or `res://…`). */
  texture?: string;
  /** Godot ExpandMode: 0 keep size, 1 ignore size, 2/3 fit width (proportional), 4/5 fit height (proportional). */
  expandMode?: number;
  /** Godot StretchMode: 0 scale, 1 tile, 2/3 keep (top-left/centered), 4/5 keep aspect, 6 covered. */
  stretchMode?: number;
  /** Mirror the texture horizontally / vertically (default off). */
  flipH?: boolean;
  flipV?: boolean;
}
