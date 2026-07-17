import type { ControlProperties } from '../control/types';

export interface VBoxContainerProperties extends ControlProperties {
  /** BoxContainer AlignmentMode: 0=BEGIN, 1=CENTER, 2=END (Godot default 0). */
  alignment?: number;
}
