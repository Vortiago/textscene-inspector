/**
 * SV-square and hue-strip vertex-colour geometry, as plain number arrays —
 * `Component.tsx` builds the `THREE.BufferGeometry` from these, matching
 * `StyleBoxQuad.tsx`'s `styleBoxFlatGeometry` split (geometry math stays
 * THREE-free).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { ControlColor } from '../control/types';
import { hsvToRgb } from './nativeSolver';

export interface QuadGeometry {
  /** x,y,z triples, LOCAL to the rect's own top-left, Godot px (+Y down — the caller flips, same convention as `styleBoxFlatGeometry`). */
  positions: number[];
  indices: number[];
  /** r,g,b,a per vertex, raw sRGB (decoded per-fragment by the caller's shader injection). */
  colors: number[];
}

function quad(w: number, h: number, corners: readonly [ControlColor, ControlColor, ControlColor, ControlColor]): QuadGeometry {
  // corners: top-left, top-right, bottom-right, bottom-left — the same order
  // `ColorPickerShape::draw_sv_square`'s own `points` array uses
  // (`color_picker_shape.cpp:233-238`).
  const positions = [0, 0, 0, w, 0, 0, w, -h, 0, 0, -h, 0];
  const indices = [0, 1, 2, 0, 2, 3];
  const colors: number[] = [];
  for (const c of corners) colors.push(c.r, c.g, c.b, c.a);
  return { positions, indices, colors };
}

const WHITE: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
const BLACK: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

/**
 * `ColorPickerShape::draw_sv_square`'s FIRST `draw_polygon`
 * (`color_picker_shape.cpp:243-249`) — an opaque white-top/black-bottom
 * gradient, independent of hue: `s=0` (grey) reads straight off this layer.
 */
export function svSquareBaseLayer(w: number, h: number): QuadGeometry {
  return quad(w, h, [WHITE, WHITE, BLACK, BLACK]);
}

/**
 * `ColorPickerShape::draw_sv_square`'s SECOND `draw_polygon` (`:251-257`),
 * blended over the base layer: transparent at `s=0` (left) fading to fully
 * opaque at `s=1` (right), the opaque edge itself running full value (top)
 * to black (bottom) — together the standard `V * mix(white, hue, s)` square.
 */
export function svSquareHueLayer(w: number, h: number, hue: number): QuadGeometry {
  const full = hsvToRgb(hue, 1, 1);
  const dark = hsvToRgb(hue, 1, 0);
  return quad(w, h, [{ ...full, a: 0 }, { ...full, a: 1 }, { ...dark, a: 1 }, { ...dark, a: 0 }]);
}

/**
 * The `color_hue` `GradientTexture2D`'s own 7 stops
 * (`default_theme.cpp:1104-1128`, `precision = 7`, `Color::from_hsv(h, 1, 1)`
 * per stop, `Gradient`'s default `GRADIENT_INTERPOLATE_LINEAR`) as one
 * vertex-coloured strip spanning the hue slider's height — continuous GPU
 * interpolation between the 7 stops rather than sampling an 800px texture,
 * exact since a hue sweep is piecewise-linear in RGB between multiples of
 * 60 degrees.
 */
export function hueStripGeometry(w: number, h: number): QuadGeometry {
  const stops = 7;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < stops; i++) {
    const t = i / (stops - 1);
    const y = -h * t;
    const c = hsvToRgb(t, 1, 1);
    positions.push(0, y, 0, w, y, 0);
    colors.push(c.r, c.g, c.b, 1, c.r, c.g, c.b, 1);
  }
  for (let i = 0; i < stops - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { positions, indices, colors };
}
