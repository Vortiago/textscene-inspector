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
  /** Texture2D reference drawn beside the text (raw, unresolved). */
  icon?: string;
  /** HorizontalAlignment of the icon. Godot default 0 (LEFT). */
  iconAlignment?: number;
  /** VerticalAlignment of the icon. Godot default 1 (CENTER). */
  verticalIconAlignment?: number;
  /** When true the icon scales to the button, keeping its aspect. Default false. */
  expandIcon?: boolean;
}
