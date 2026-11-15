import type { ControlProperties } from '../control/types';

export interface VideoStreamPlayerProperties extends ControlProperties {
  /** Raw `stream` ref (for example `ExtResource("id")`), resolved against the scene's resource table. */
  stream?: string;
  /** Whether the player ignores the picture size as its minimum size (default off). */
  expand: boolean;
}
