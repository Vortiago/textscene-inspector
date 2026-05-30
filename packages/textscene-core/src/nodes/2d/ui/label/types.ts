import type { ControlProperties } from '../control/types';

export interface LabelProperties extends ControlProperties {
  text?: string;
  /** Godot HorizontalAlignment: 0 left, 1 center, 2 right, 3 fill. */
  horizontalAlignment?: number;
  /** Godot VerticalAlignment: 0 top, 1 center, 2 bottom, 3 fill. */
  verticalAlignment?: number;
  /** Godot autowrap mode (0 = off). Non-zero wraps text. */
  autowrapMode?: number;
}
