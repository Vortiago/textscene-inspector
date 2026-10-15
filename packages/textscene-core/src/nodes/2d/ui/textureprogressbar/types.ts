import type { ControlProperties } from '../control/types';
import type { RangeProperties } from '../shared/range';
import type { Rgba } from '../../../../godot/math';

/** `TextureProgressBar::FillMode` (`texture_progress_bar.h:48-58`). */
export const FillMode = {
  LEFT_TO_RIGHT: 0,
  RIGHT_TO_LEFT: 1,
  TOP_TO_BOTTOM: 2,
  BOTTOM_TO_TOP: 3,
  CLOCKWISE: 4,
  COUNTER_CLOCKWISE: 5,
  BILINEAR_LEFT_AND_RIGHT: 6,
  BILINEAR_TOP_AND_BOTTOM: 7,
  CLOCKWISE_AND_COUNTER_CLOCKWISE: 8,
} as const;

/** `TextureProgressBar`'s own members (`doc/classes/TextureProgressBar.xml`), plus its Control + Range bases. */
export interface TextureProgressBarProperties extends ControlProperties, RangeProperties {
  /** A `FillMode` value. */
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
  tintOver?: Rgba;
  tintProgress?: Rgba;
  tintUnder?: Rgba;
}
