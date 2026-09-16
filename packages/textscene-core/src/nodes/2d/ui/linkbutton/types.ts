import type { ControlProperties } from '../control/types';

export interface LinkButtonProperties extends ControlProperties {
  /** The link's own label text. */
  text?: string;
  /** Never navigated — parsed for completeness only. */
  uri?: string;
  /** UnderlineMode (0=ALWAYS, 1=ON_HOVER, 2=NEVER). Godot default 0 (ALWAYS). */
  underline?: number;
  /**
   * `TextServer::OverrunBehavior` (0=NO_TRIMMING .. 6). Only the
   * NO_TRIMMING/not-NO_TRIMMING split is modelled (`get_minimum_size`
   * zeroes the width otherwise, `link_button.cpp:230-236`) — actual
   * character trimming/ellipsis is not drawn.
   */
  overrunBehavior?: number;
  /** `LinkButton.ellipsis_char`'s first character; undefined falls back to the engine default (…). */
  ellipsisChar?: string;
  /** BaseButton's own disabled flag (`base_button.cpp:567`) — LinkButton parses no `_bind_methods` of its own beyond `text`/`underline`/`uri`, so this is read the same inline way every other BaseButton-family slice does. */
  disabled?: boolean;
  /** BaseButton's own button_pressed flag (`base_button.cpp:569`). */
  buttonPressed?: boolean;
}
