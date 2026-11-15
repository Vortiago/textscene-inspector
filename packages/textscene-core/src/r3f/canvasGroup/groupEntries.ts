/**
 * The shapes a canvas group hands the pass: its window, its buffer and, for a `clip_children`
 * owner, its mask switch.
 */

import type * as THREE from 'three';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import type { CanvasGroupWindow, KeySpan } from './groupWindow';

/**
 * What a clipping group asks of the pass. `clipOnly` leaves the owner out of the buffer, and
 * `clipAndDraw` draws it there too (`renderer_canvas_render_rd.cpp:822-828`).
 */
export interface CanvasGroupClip {
  readonly mode: 'clipOnly' | 'clipAndDraw';
  /**
   * Switches the owner's pixels to the mask: the buffer's colour under the owner's own alpha. The
   * pass starts it while the frame draws the owner and stops it at every other draw.
   */
  startMasking(): void;
  stopMasking(): void;
  /**
   * The keys of the owner's `show_behind_parent` children. They draw first while the owner draws
   * nothing, which leaves it without a group.
   */
  readonly behind: readonly KeySpan[];
}

interface GroupBase {
  readonly window: CanvasGroupWindow;
  /**
   * Fits the group's rect over `drawn`, the world boxes of its drawn items. `frameClip` is the clip
   * the frame's camera shows, null for a camera with no ortho view. Answers the rect an enclosing
   * group merges, or null when the group draws nothing.
   */
  fit(drawn: readonly THREE.Box3[], frameClip: CanvasClip | null): THREE.Box3 | null;
}

/** A CanvasGroup: its items draw into a cleared buffer that its rect composites over the frame. */
export interface CompositeEntry extends GroupBase {
  readonly kind: 'composite';
  /** The target the items draw into while the rect reads it, or null while a material replaces that. */
  readonly buffer: THREE.WebGLRenderTarget | null;
  /** `fit` for a group inside another group's window, which draws its rect plain into the outer buffer. */
  fitNested(drawn: readonly THREE.Box3[], frameClip: CanvasClip | null): THREE.Box3 | null;
}

/** The owner of `clip_children`: its items draw over a copy of the canvas, and its pixels take the mask. */
export interface ClippingEntry extends GroupBase {
  readonly kind: 'clip';
  readonly clip: CanvasGroupClip;
  readonly buffer: THREE.WebGLRenderTarget;
  /** Whether the owner's shader reads `buffer`. A CanvasItemMaterial on a CLIP_ONLY owner replaces it. */
  readonly readsBuffer: boolean;
}

/** What a mounted group hands the pass of its canvas. */
export type CanvasGroupEntry = CompositeEntry | ClippingEntry;

/** The target `draw` fills: its size is the buffers' size, and its texture is what a clip copies. */
export type CanvasFrameTarget = Pick<THREE.WebGLRenderTarget, 'width' | 'height' | 'texture'>;

/** A clipping owner that draws nothing, with the keys of its behind-parent children. */
export interface InertOwner {
  readonly window: CanvasGroupWindow;
  readonly behind: readonly KeySpan[];
}
