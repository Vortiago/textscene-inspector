import type { VBoxContainerProperties } from '../vboxcontainer/types';

export interface ColorPickerProperties extends VBoxContainerProperties {
  /** Raw Godot `Color(r,g,b,a)` string — Godot default `Color()` = opaque black. */
  color?: string;
  /**
   * `PickerShapeType` 0-6. Godot default `SHAPE_HSV_RECTANGLE` (0). Only 0
   * is drawn (`Component.tsx`'s own doc) — every other value picks a
   * shader-backed shape this previewer does not reproduce.
   */
  pickerShape?: number;
}
