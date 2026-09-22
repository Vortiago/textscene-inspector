import type { ButtonProperties } from '../button/types';

export interface ColorPickerButtonProperties extends ButtonProperties {
  /** Raw Godot `Color(r,g,b,a)` swatch string — Godot default `Color()` = opaque black. */
  color?: string;
}
