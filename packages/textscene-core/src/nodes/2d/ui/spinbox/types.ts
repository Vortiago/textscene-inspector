/** SpinBox property definitions: Control and Range plus SpinBox's own members. */

import type { ControlProperties } from '../control/types';
import type { RangeProperties } from '../shared/range';

export interface SpinBoxProperties extends ControlProperties, RangeProperties {
  /** `HorizontalAlignment` forwarded straight to the internal field. Godot default 0 (LEFT). */
  alignment?: number;
  /** Godot default true. Forwarded to the internal LineEdit; also gates both stepper buttons. */
  editable?: boolean;
  /** Interaction-only: re-parses live text as it changes. Godot default false. */
  updateOnTextChanged?: boolean;
  /** Prepended to the displayed value, space-separated. Godot default "". */
  prefix?: string;
  /** Appended to the displayed value, space-separated. Godot default "". */
  suffix?: string;
  /** Per-click step for the arrow buttons, overriding `step` when non-zero. Godot default 0. */
  customArrowStep?: number;
  /** Snap `customArrowStep` to a multiple of `step`. Godot default false. */
  customArrowRound?: boolean;
  /** Interaction-only. Godot default true. */
  selectAllOnFocus?: boolean;
}
