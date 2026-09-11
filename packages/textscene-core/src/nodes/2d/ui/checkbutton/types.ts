import type { ButtonProperties } from '../button/types';

export interface CheckButtonProperties extends ButtonProperties {
  /** Whether the switch is in the on/checked state. */
  buttonPressed?: boolean;
}
