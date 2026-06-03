import type { ControlProperties } from '../control/types';

export interface ScrollContainerProperties extends ControlProperties {
  /** Godot ScrollMode (0 DISABLED, 1 AUTO, 2 SHOW_ALWAYS, 3 SHOW_NEVER, 4 RESERVE). */
  horizontalScrollMode?: number;
  verticalScrollMode?: number;
}
