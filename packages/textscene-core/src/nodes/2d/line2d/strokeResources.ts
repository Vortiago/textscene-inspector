/** Adapts a decoded `Gradient` and `Curve` to the samplers `buildLineStroke` takes. */

import { bakedCurveSampler } from '../../../resources/curves/curve/bakedSample';
import type { Curve } from '../../../resources/curves/curve/types';
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/sample';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import type { StrokeGradient } from './lineBuilder';

/** `Gradient::get_color(0)` of a gradient with no stop, which Godot refuses and answers black. */
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

/** The colours of `gradient` along a line: its first stop, its last and `get_color_at_offset` between. */
export function strokeGradient(gradient: Gradient): StrokeGradient {
  const { stops } = gradient;
  return {
    first: stops[0]?.color ?? BLACK,
    last: stops[stops.length - 1]?.color ?? BLACK,
    colorAt: (offset) => sampleGradientColor(gradient, offset),
  };
}

/** `Curve.sample_baked` of `curve`, which answers 0 for a curve with no point. */
export function strokeWidthFactor(curve: Curve): (offset: number) => number {
  return bakedCurveSampler(curve);
}
