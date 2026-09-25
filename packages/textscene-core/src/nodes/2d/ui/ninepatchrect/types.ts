/** NinePatchRect's parsed properties: Control plus texture ref, patch margins, region and axis stretch. */

import type { ControlProperties } from '../control/types';

export interface Rect2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NinePatchRectProperties extends ControlProperties {
  /** Raw `texture` ref (for example `ExtResource("id")`). Undefined draws nothing. */
  texture?: string;
  /** Godot AxisStretchMode: 0 stretch, 1 tile, 2 tile-fit. Default 0 (`nine_patch_rect.h:50-51`). */
  axisStretchHorizontal?: number;
  axisStretchVertical?: number;
  /** Whether the centre cell draws. Default true (`nine_patch_rect.h:45`). */
  drawCenter?: boolean;
  /** Texture-pixel margins from each edge, splitting the nine cells. Default 0 (`nine_patch_rect.h:46`). */
  patchMarginLeft?: number;
  patchMarginTop?: number;
  patchMarginRight?: number;
  patchMarginBottom?: number;
  /** Source window within the texture. Unset or all-zero means the whole texture. */
  regionRect?: Rect2;
}
