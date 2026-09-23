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
  /** `TextServer::OverrunBehavior` (0-6). Godot default 0 (OVERRUN_NO_TRIMMING). */
  overrunBehavior?: number;
  /** `Button.clip_text`: collapses the text's minimum-width contribution to 0 (button.cpp:492-494), as a trimming `overrunBehavior` does. */
  clipText?: boolean;
  /** `TextServer::AutowrapMode` (0 OFF, 1 ARBITRARY, 2 WORD, 3 WORD_SMART). Godot default 0 (`button.h`). */
  autowrapMode?: number;
  /** `TextServer::LineBreakFlag` trim bits ORed onto the mode's own break flags (`button.cpp:560`). Godot default `BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES`. */
  autowrapTrimFlags?: number;
}
