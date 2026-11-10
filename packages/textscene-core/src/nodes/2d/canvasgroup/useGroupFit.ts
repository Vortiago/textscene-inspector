/**
 * The rect step both kinds of canvas group share, a CanvasGroup and a node with `clip_children`:
 * fit the rect over the items the group lists, in the pixels of the clip the canvas last framed
 * (`renderer_canvas_cull.cpp:196-256`).
 */

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rect2Grow, type Rect2 } from '../../../godot/math/rect2';
import { useCanvasLighting2D } from '../../../r3f/lighting2d/CanvasLighting2D';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';
import { compositeRect } from './compositeRect';
import { canvasPixelRect, clipPixelRect, worldBoxOfCanvasPixels } from './canvasPixels';

/** The two world boxes a fit answers. `fitted` is read at once: every group shares it. */
export interface FittedRects {
  /** The rect the group's pixels cover: the listed items grown by `fit_margin`. */
  fitted: THREE.Box3;
  /** `fitted` grown by `clear_margin`, which an enclosing group merges. */
  cleared: THREE.Box3;
}

/** Fits a group over `drawn`, the world boxes of its items, or answers null when it lists none. */
export type GroupFit = (drawn: readonly THREE.Box3[], frameClip: CanvasClip | null) => FittedRects | null;

/** The fit of a group with the given margins, in canvas pixels. */
export function useGroupFit(margins: { fitMargin: number; clearMargin: number }): GroupFit {
  const { fitMargin, clearMargin } = margins;
  const clip = useClip();
  // One box per group, so no two groups share the rect an enclosing group merges in the same frame.
  const cleared = useMemo(() => new THREE.Box3(), []);
  return useCallback(
    (drawn, frameClip) => {
      // A canvas with no light pass, such as an inline SubViewport's, takes the frame's own clip.
      const framed = clip.current ?? frameClip;
      if (!framed) return null;
      const pixels = fittedRect(drawn, framed, frameClip, fitMargin);
      if (!pixels) return null;
      return {
        fitted: worldBoxOfCanvasPixels(pixels, framed, fittedBox),
        cleared: worldBoxOfCanvasPixels(rect2Grow(pixels, clearMargin), framed, cleared),
      };
    },
    [clip, cleared, fitMargin, clearMargin]
  );
}

/** The clip of this canvas, as its light pass last framed it. */
function useClip(): { current: CanvasClip | null } {
  const clip = useRef<CanvasClip | null>(null);
  const { registerPassStep } = useCanvasLighting2D();
  useLayoutEffect(
    () =>
      registerPassStep((_camera, framed) => {
        clip.current = framed;
      }),
    [registerPassStep]
  );
  return clip;
}

/** The composite rect over `drawn`, in canvas pixels, or null when the group draws nothing. */
function fittedRect(
  drawn: readonly THREE.Box3[],
  clip: CanvasClip,
  frameClip: CanvasClip | null,
  fitMargin: number
): Rect2 | null {
  return compositeRect(
    drawn.map((box) => canvasPixelRect(box, clip)),
    shownPixelRect(clip, frameClip),
    fitMargin
  );
}

const shownBox = new THREE.Box3();

/** The world box of `fitted`, shared by every group. */
const fittedBox = new THREE.Box3();

/**
 * The part of the canvas the frame shows, in `clip`'s pixels, which lists the items the group
 * fits. It is the clip in a SubViewport. The root stage shows a panned view past Godot's viewport,
 * and an item there draws as it does outside any group.
 */
function shownPixelRect(clip: CanvasClip, frameClip: CanvasClip | null): Rect2 {
  if (!frameClip) return clipPixelRect(clip);
  const { x, y, w, h } = frameClip.rect;
  shownBox.min.set(x, y, 0);
  shownBox.max.set(x + w, y + h, 0);
  return canvasPixelRect(shownBox, clip);
}
