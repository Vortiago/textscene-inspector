import type { VBoxContainerProperties } from '../vboxcontainer/types';

export interface ColorPickerProperties extends VBoxContainerProperties {
  /**
   * Raw Godot `Color(r,g,b,a)` string. Godot default `Color()` is opaque
   * black, but `ColorPicker`'s own constructor immediately calls
   * `set_pick_color(Color(1, 1, 1))` (`color_picker.cpp:2289`) before the
   * scene loader ever runs, so the SAVED default — what an omitted `color`
   * key means — is opaque WHITE, not black.
   */
  color?: string;
  /**
   * `PickerShapeType` 0-6. Godot default `SHAPE_HSV_RECTANGLE` (0). Only 0
   * is drawn (`Component.tsx`'s own doc) — every other value picks a
   * shader-backed shape this previewer does not reproduce.
   */
  pickerShape?: number;
  /** `ColorModeType` 0-3 (RGB/HSV/Linear/OKHSL). Godot default `MODE_RGB` (0). */
  colorMode?: number;
  /** Godot default `true` — shows the RGB/HSV/Linear buttons + mode dropdown. */
  colorModesVisible?: boolean;
  /** Godot default `true` — shows the channel slider grid. */
  slidersVisible?: boolean;
  /** Godot default `true` — shows the hex/expression field. */
  hexVisible?: boolean;
  /** Godot default `true` — shows the swatches/presets rows. */
  presetsVisible?: boolean;
  /** Godot default `true` — shows the sample row (colour swatch + pick/shape buttons). */
  samplerVisible?: boolean;
  /** Godot default `true` (`color_picker.h:254`) — shows the alpha slider row. */
  editAlpha?: boolean;
  /** Godot default `true` (`color_picker.h:260`) — shows the intensity slider row. */
  editIntensity?: boolean;
}
