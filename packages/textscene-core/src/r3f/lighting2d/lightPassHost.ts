/**
 * What drives a 2D light pass: the canvas it lights, and the caller that runs it each frame. The
 * 2D stage hosts one pass, and each SubViewport with 2D content hosts one over its own offscreen
 * target (`viewport.cpp:5345`).
 */

import type * as THREE from 'three';
import type { Rect2 } from '../../godot/math/rect2.js';
import type { Vector2 } from '../../godot/math/vector.js';

/**
 * The part of the canvas the pass shows: Godot's `clip_rect`, `Rect2(0, 0, size)` in screen pixels
 * (`renderer_viewport.cpp:390`), seen from the canvas.
 */
export interface CanvasClip {
  /** The rect in the Y-up world. */
  readonly rect: Rect2;
  /** Screen pixels per world unit on each axis, the canvas transform's scale. */
  readonly scale: Vector2;
}

export interface LightPassHost {
  /** The path of the SubViewport whose canvas this is, or null for the root canvas. */
  readonly canvasPath: string | null;
  /** The scene that holds the canvas items and the light meshes. */
  readonly scene: THREE.Scene;
  /** The camera the canvas is drawn through, the one the accumulation draws through too. */
  readonly camera: THREE.Camera;
  /**
   * Written by the pass while it is mounted, and null otherwise. The host calls it once a frame,
   * after it has framed `camera` and before it draws the canvas.
   */
  readonly run: { current: (() => void) | null };
  /**
   * Writes the size of the accumulation buffers into `out`, in the unit of `gl_FragCoord`: the
   * size of the target the canvas is drawn into.
   */
  readBufferSize(out: THREE.Vector2): void;
  /** The clip now. The same object while it does not change, so a caller can compare by identity. */
  readClip(): CanvasClip;
}
