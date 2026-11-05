/** CheckBox property definitions. */

import type { ControlProperties } from '../control/types';

export interface CheckBoxProperties extends ControlProperties {
  /** CheckBox label text. */
  text?: string;
  /** `TextServer::OverrunBehavior` (0-6). Godot default 0 (OVERRUN_NO_TRIMMING). */
  overrunBehavior?: number;
  /** Whether the checkbox is in the checked/pressed state. */
  buttonPressed?: boolean;
  /** Disabled checkboxes render dimmed and non-interactive. */
  disabled?: boolean;
  /** `alignment` (`HorizontalAlignment`). CheckBox's default is LEFT (`check_box.cpp:174`). */
  alignment?: number;
  /** `Button.clip_text`: zeroes the text's minimum-width contribution (`button.cpp:493-495`). */
  clipText?: boolean;
  /**
   * A `ButtonGroup` reference. Godot swaps the check glyph for the `radio_*`
   * icons when a CheckBox belongs to one (`check_box.cpp::is_radio`), so this
   * is a render input, not just metadata.
   */
  buttonGroup?: string;
}
