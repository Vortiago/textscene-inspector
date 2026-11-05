/** CheckBox property definitions. */

import type { ControlProperties } from '../control/types';
import type { TextDirectionProperties } from '../../../../godot/text/paragraphDirection';

/** The label shapes in `text_direction` and `language`, else the locale (`button.cpp:564-569`). */
export interface CheckBoxProperties extends ControlProperties, TextDirectionProperties {
  /** CheckBox label text. */
  text?: string;
  /** Whether the checkbox is in the checked/pressed state. */
  buttonPressed?: boolean;
  /** Disabled checkboxes render dimmed and non-interactive. */
  disabled?: boolean;
  /**
   * A `ButtonGroup` reference. Godot swaps the check glyph for the `radio_*`
   * icons when a CheckBox belongs to one (`check_box.cpp::is_radio`), so this
   * is a render input, not just metadata.
   */
  buttonGroup?: string;
}
