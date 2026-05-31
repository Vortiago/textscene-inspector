import type { ControlProperties } from '../control/types';

export interface ButtonProperties extends ControlProperties {
  /** Button label text. */
  text?: string;
  /** Disabled buttons render dimmed and non-interactive. */
  disabled?: boolean;
  /** Flat buttons drop the default background/border chrome. */
  flat?: boolean;
  /** HorizontalAlignment of the text (0=left, 1=center, 2=right, 3=fill). */
  alignment?: number;
}
