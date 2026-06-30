/** CheckBox property definitions. */

import type { ControlProperties } from '../control/types';

export interface CheckBoxProperties extends ControlProperties {
  /** CheckBox label text. */
  text?: string;
  /** Whether the checkbox is in the checked/pressed state. */
  buttonPressed?: boolean;
  /** Disabled checkboxes render dimmed and non-interactive. */
  disabled?: boolean;
}
