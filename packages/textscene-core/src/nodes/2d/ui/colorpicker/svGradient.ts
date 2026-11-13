/**
 * Vertex-colour geometry of the SV square, the vertical shape sliders and the channel bands,
 * as plain arrays. `Component.tsx` and `shapes/ShapeRow.tsx` build the `THREE.BufferGeometry`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { hsvToRgb } from '../../../../godot/math/color';
import type { Rgba } from '../../../../godot/math/math';

export interface QuadGeometry {
  /** x,y,z triples from the rect's top-left, in Godot px. The caller flips +Y down, as for `styleBoxFlatGeometry`. */
  positions: number[];
  indices: number[];
  /** r,g,b,a per vertex in raw sRGB. The caller's shader decodes each fragment. */
  colors: number[];
}

function quad(w: number, h: number, corners: readonly [Rgba, Rgba, Rgba, Rgba]): QuadGeometry {
  // Corners run top-left, top-right, bottom-right, bottom-left, as the `points` of
  // `ColorPickerShape::draw_sv_square` do (`color_picker_shape.cpp:233-238`).
  const positions = [0, 0, 0, w, 0, 0, w, -h, 0, 0, -h, 0];
  const indices = [0, 1, 2, 0, 2, 3];
  const colors: number[] = [];
  for (const c of corners) colors.push(c.r, c.g, c.b, c.a);
  return { positions, indices, colors };
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/**
 * The first `draw_polygon` of `ColorPickerShape::draw_sv_square`
 * (`color_picker_shape.cpp:243-249`): opaque white at the top to black at the
 * bottom, for every hue.
 */
export function svSquareBaseLayer(w: number, h: number): QuadGeometry {
  return quad(w, h, [WHITE, WHITE, BLACK, BLACK]);
}

/**
 * The second `draw_polygon` (`:251-257`) over the base: transparent at `s=0`
 * on the left to opaque at `s=1`, from the full hue at the top to black.
 * Together the two layers give `V * mix(white, hue, s)`.
 */
export function svSquareHueLayer(w: number, h: number, hue: number): QuadGeometry {
  const full = hsvToRgb(hue, 1, 1);
  const dark = hsvToRgb(hue, 1, 0);
  return quad(w, h, [
    { ...full, a: 0 },
    { ...full, a: 1 },
    { ...dark, a: 1 },
    { ...dark, a: 0 },
  ]);
}

/** The edge across a strip at stop `i`: two x,y,z points. */
type StripEdge = (i: number, segments: number) => readonly number[];

/** One quad spans each pair of stops, with each stop's colour on both vertices of its edge. */
function strip(stops: readonly Rgba[], edgeAt: StripEdge): QuadGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const segments = stops.length - 1;
  stops.forEach((c, i) => {
    positions.push(...edgeAt(i, segments));
    colors.push(c.r, c.g, c.b, c.a, c.r, c.g, c.b, c.a);
  });
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { positions, indices, colors };
}

/**
 * A horizontal gradient strip with N stops spaced evenly across `w`, for every
 * channel-slider draw of `color_mode.cpp` and `color_picker.cpp`. The colour varies along x only.
 */
export function horizontalStripGeometry(w: number, h: number, stops: readonly Rgba[]): QuadGeometry {
  return strip(stops, (i, segments) => {
    const x = (w * i) / segments;
    return [x, 0, 0, x, -h, 0];
  });
}

/**
 * A vertical gradient strip with N stops spaced evenly from the top to the bottom of `h`: the
 * `color_hue` rainbow of the HSV rectangle and the value sliders of the other shapes.
 */
export function verticalStripGeometry(w: number, h: number, stops: readonly Rgba[]): QuadGeometry {
  return strip(stops, (i, segments) => {
    const y = -h * (i / segments);
    return [0, y, 0, w, y, 0];
  });
}

/**
 * `Color::srgb_to_linear` per stop (`core/math/color.h:192-198`).
 * `GRADIENT_COLOR_SPACE_LINEAR_SRGB` interpolates linear stops (`color_mode.cpp:311`),
 * and RGB mode uses `_SRGB` (`:113`). The caller's GPU lerp then runs on linear
 * values with no sRGB decode.
 */
export function linearizeStops(stops: readonly Rgba[]): Rgba[] {
  return stops.map((c) => ({
    r: sRGBChannelToLinear(c.r),
    g: sRGBChannelToLinear(c.g),
    b: sRGBChannelToLinear(c.b),
    a: c.a,
  }));
}

const COLOR_HUE_STOP_COUNT = 7;

/**
 * The 7 stops of the `color_hue` `GradientTexture2D`, the default theme's `ColorPicker/color_hue` icon,
 * `Color::from_hsv(i / 6, 1, 1)`, in order. A hue sweep is piecewise linear in RGB
 * between multiples of 60 degrees, so a GPU lerp between the stops is exact.
 */
export const COLOR_HUE_STOPS: readonly Rgba[] = Array.from({ length: COLOR_HUE_STOP_COUNT }, (_, i) => ({
  ...hsvToRgb(i / (COLOR_HUE_STOP_COUNT - 1), 1, 1),
  a: 1,
}));
