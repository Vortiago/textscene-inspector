import type { ControlProperties } from '../control/types';
import type { TextDirectionProperties } from '../../../../godot/text/paragraphDirection';

/** The label shapes in `text_direction` and `language`, else the locale (`button.cpp:564-569`). */
export interface ButtonProperties extends ControlProperties, TextDirectionProperties {
  /** Button label text. */
  text?: string;
  /** Disabled buttons render dimmed and non-interactive. */
  disabled?: boolean;
  /**
   * The button holds its viewport's focus (`button.cpp:220,284`). Not a scene property: a scene has
   * no focus, so only a Control that grabs it for its own button, an AcceptDialog's OK, sets it.
   */
  hasFocus?: boolean;
  /** The toggle is on: `toggle_mode` and `button_pressed` (`BaseButton::set_pressed` refuses a button that is no toggle, `base_button.cpp`). */
  buttonPressed?: boolean;
  /**
   * A theme icon a Control gives its own Button (`set_button_icon`), which `SolveNode.icons[name]` resolves
   * and `vendoredUrl` stands in for. Not a scene property: only a Control that builds Buttons sets it.
   */
  themedIcon?: { name: string; vendoredUrl: string };
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
  /** `Button.clip_text`: collapses the text's minimum-width contribution to 0 (button.cpp:493-495), as a trimming `overrunBehavior` does. */
  clipText?: boolean;
  /** `TextServer::AutowrapMode` (0 OFF, 1 ARBITRARY, 2 WORD, 3 WORD_SMART). Godot default 0 (`button.h`). */
  autowrapMode?: number;
  /** `TextServer::LineBreakFlag` trim bits ORed onto the mode's own break flags (`button.cpp:560`). Godot default `BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES`. */
  autowrapTrimFlags?: number;
}
