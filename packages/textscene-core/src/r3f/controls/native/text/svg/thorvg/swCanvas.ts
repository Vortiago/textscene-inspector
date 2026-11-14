/**
 * ThorVG's `SwCanvas` as Godot drives it for one glyph (`tvgCanvas.h`, `tvgSwCanvas.cpp`): a
 * target of straight ARGB words, one paint pushed, updated with every flag, and drawn.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { identityMatrix } from './math';
import type { Paint } from './paint';
import { SwRenderer } from './sw/swRenderer';

/**
 * The straight ARGB words of `paint` drawn on a `w` by `h` canvas, or null where the canvas does
 * not draw: a canvas of no area, or a paint that renders nothing (`Canvas::Impl::draw`).
 */
export function drawOnCanvas(paint: Paint, w: number, h: number): Uint32Array | null {
  if (w === 0 || h === 0) return null;
  const renderer = new SwRenderer(w, h);
  paint.update(renderer, identityMatrix(), [], 255, false);
  if (!renderer.preRender()) return null;
  if (!paint.render(renderer)) return null;
  renderer.postRender();
  return renderer.pixels;
}
