import type { VBoxContainerProperties } from '../vboxcontainer/types';

export interface ColorPickerProperties extends VBoxContainerProperties {
  /**
   * Raw Godot `Color(r,g,b,a)` string. The constructor calls
   * `set_pick_color(Color(1, 1, 1))` (`color_picker.cpp:2289`), so an omitted
   * `color` means opaque white.
   */
  color?: string;
  /**
   * `PickerShapeType` 0-6, default `SHAPE_HSV_RECTANGLE` (0). Only 0 is drawn:
   * every other value picks a shader-backed shape.
   */
  pickerShape?: number;
  /** `ColorModeType` 0-3 (RGB/HSV/Linear/OKHSL). Godot default `MODE_RGB` (0). */
  colorMode?: number;
  /** Default `true`: shows the mode buttons and the mode dropdown. */
  colorModesVisible?: boolean;
  /** Default `true`: shows the channel slider grid. */
  slidersVisible?: boolean;
  /** Default `true`: shows the hex or expression field. */
  hexVisible?: boolean;
  /** Default `true`: shows the swatches rows. */
  presetsVisible?: boolean;
  /** Default `true`: shows the sample row, with the swatch and the pick and shape buttons. */
  samplerVisible?: boolean;
  /** Default `true` (`color_picker.h:254`): shows the alpha slider row. */
  editAlpha?: boolean;
  /** Default `true` (`color_picker.h:260`): shows the intensity slider row. */
  editIntensity?: boolean;
}
