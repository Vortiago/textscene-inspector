import type { ControlProperties, ControlColor } from '../control/types';
import type { RangeProperties } from '../shared/range';

/** `TextureProgressBar`'s own members (`doc/classes/TextureProgressBar.xml`), plus its Control + Range bases. */
export interface TextureProgressBarProperties extends ControlProperties, RangeProperties {
  /** `FillMode`: 0-3 linear, 4 clockwise, 5 counter-clockwise, 6-7 bilinear, 8 clockwise+counter-clockwise. */
  fillMode?: number;
  /** Window `texture_progress` (and, when set, `texture_under`/`texture_over` at ratio 1) as a 9-patch. Godot default false. */
  ninePatchStretch?: boolean;
  /** Pixel offset of the radial fill's centre from the texture's own centre. */
  radialCenterOffset?: { x: number; y: number };
  /** Degrees swept by a full (ratio 1) radial fill. Godot default 360. */
  radialFillDegrees?: number;
  /** Degrees the radial fill starts at. Godot default 0. */
  radialInitialAngle?: number;
  stretchMarginBottom?: number;
  stretchMarginLeft?: number;
  stretchMarginRight?: number;
  stretchMarginTop?: number;
  /** Raw `texture_over` ref. */
  textureOver?: string;
  /** Raw `texture_progress` ref. */
  textureProgress?: string;
  /** Pixel offset applied to every non-radial `texture_progress` draw. */
  textureProgressOffset?: { x: number; y: number };
  /** Raw `texture_under` ref. */
  textureUnder?: string;
  tintOver?: ControlColor;
  tintProgress?: ControlColor;
  tintUnder?: ControlColor;
}
