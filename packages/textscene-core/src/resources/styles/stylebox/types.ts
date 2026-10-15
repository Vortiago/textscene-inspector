/**
 * `StyleBox`: the theme resource a Control paints its box with. This slice
 * decodes the two that CSS can express: `StyleBoxFlat` and `StyleBoxEmpty`.
 */

import type { Rgba } from '../../../godot/math';
import type { Vector2 } from '../../../godot/vector';

/** Godot's four `Side`s (SIDE_LEFT…SIDE_BOTTOM), as border widths or margins. */
export interface StyleBoxSides {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Godot's four `Corner`s, in its `corner_radius` array order. */
interface StyleBoxCorners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface StyleBoxFlatData {
  kind: 'flat';
  /** The interior fill. Painted only when `drawCenter` is on. */
  bgColor: Rgba;
  /** `false` paints the border alone, leaving the interior transparent. */
  drawCenter: boolean;
  cornerRadius: StyleBoxCorners;
  borderWidth: StyleBoxSides;
  borderColor: Rgba;
  /**
   * The margins content sits inside, with `StyleBox::get_margin`'s rule already
   * applied: a side left negative (the −1 default) reports the side's border
   * width instead, so a border-only box still pads by its border thickness.
   */
  contentMargin: StyleBoxSides;
  /** Godot draws the drop shadow only from 1 pixel up. */
  shadowSize: number;
  shadowColor: Rgba;
  shadowOffset: Vector2;
}

/** `StyleBoxEmpty`: a box that draws nothing, but is still a box we decode. */
interface StyleBoxEmptyData {
  kind: 'empty';
}

export type StyleBoxData = StyleBoxFlatData | StyleBoxEmptyData;
