import type { ButtonProperties } from '../button/types';

export interface ColorPickerButtonProperties extends ButtonProperties {
  /** Raw Godot `Color(r,g,b,a)` swatch string. The default `Color()` is opaque black. */
  color?: string;
}
