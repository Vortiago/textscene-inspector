import * as THREE from 'three';
import type { Rect2 } from '../../godot/math/rect2.js';
import type { Vector2 } from '../../godot/math/vector.js';
import type { RootWindow } from './rootWindow.js';

/** A WebGL viewport, from the bottom-left: the window fills the pane at one scale, centred. */
export function targetRectInPane(pane: Vector2, window: Pick<RootWindow, 'size' | 'drawRect'>): Rect2 {
  const scale = paneScale(pane, window.size);
  const left = (pane.x - window.size.x * scale) / 2;
  const top = (pane.y - window.size.y * scale) / 2;
  const { x, y, w, h } = window.drawRect;
  return { x: left + x * scale, y: pane.y - top - (y + h) * scale, w: w * scale, h: h * scale };
}

/** The one scale at which a window of `size` fills `pane`. */
export function paneScale(pane: Vector2, size: Vector2): number {
  return Math.min(pane.x / size.x, pane.y / size.y);
}

/** A nearest sample this far into a texel edge lands where an exact one would. */
const TIE_TEXELS = 1 / 1024;

/** The quad shift of a blit of `source`: the tie shift where it samples nearest, none where linear. */
export function blitShift(source: Pick<THREE.Texture, 'image' | 'magFilter'>): Vector2 {
  if (source.magFilter !== THREE.NearestFilter) return { x: 0, y: 0 };
  const { width, height } = source.image as { width: number; height: number };
  return nearestTieShift({ x: width, y: height });
}

/** The quad shift, in clip space, that floors an edge sample as Godot does (`image.cpp:1081,1085`). */
function nearestTieShift(targetSize: Vector2): Vector2 {
  return { x: (-2 * TIE_TEXELS) / targetSize.x, y: (2 * TIE_TEXELS) / targetSize.y };
}
