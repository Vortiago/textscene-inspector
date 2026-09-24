import type { ControlProperties } from '../control/types';

export interface LinkButtonProperties extends ControlProperties {
  /** The link's own label text. */
  text?: string;
  /** Never navigated, parsed for completeness only. */
  uri?: string;
  /** UnderlineMode (0=ALWAYS, 1=ON_HOVER, 2=NEVER). Godot default 0 (ALWAYS). */
  underline?: number;
  /**
   * `TextServer::OverrunBehavior` (0=NO_TRIMMING .. 6). Any value but NO_TRIMMING zeroes the minimum
   * width (`link_button.cpp:230-236`) and trims the drawn text to the rect.
   */
  overrunBehavior?: number;
  /** `LinkButton.ellipsis_char`'s first character. Undefined means the engine default (…). */
  ellipsisChar?: string;
  /** BaseButton's disabled flag (`base_button.cpp:567`), read inline as every BaseButton-family slice does. */
  disabled?: boolean;
  /** BaseButton's own button_pressed flag (`base_button.cpp:569`). */
  buttonPressed?: boolean;
}
