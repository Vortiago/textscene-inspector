/** CheckBox property definitions. */

import type { ButtonProperties } from '../button/types';

/** Button's properties, which a CheckBox parses and shapes its label with (`check_box.h:35`), plus its `button_group`. */
export interface CheckBoxProperties extends ButtonProperties {
  /**
   * A `ButtonGroup` reference. Godot swaps the check glyph for the `radio_*`
   * icons when a CheckBox belongs to one (`check_box.cpp::is_radio`), so this
   * is a render input, not just metadata.
   */
  buttonGroup?: string;
}
