/**
 * The object whose world matrix carries a canvas into three's world: a CanvasLayer's transform under
 * its viewport anchor. Godot shades a normal-mapped item in the canvas transform's pixels, so a light
 * reads this frame to scale what it gives in canvas pixels.
 */

import { createContext, useContext } from 'react';
import type * as THREE from 'three';

/** Null on the root canvas, whose frame is the world itself. */
export const CanvasFrameContext = createContext<THREE.Object3D | null>(null);
CanvasFrameContext.displayName = 'CanvasFrameContext';

/** The frame of the canvas this node draws in. */
export function useCanvasFrame(): THREE.Object3D | null {
  return useContext(CanvasFrameContext);
}

/** Written only by {@link markCanvasFrame}, as a CanvasLayer's frame mounts. */
const canvasFrames = new WeakSet<THREE.Object3D>();

/** Marks `frame` as the frame of a canvas, which {@link canvasFrameOf} finds above a node. */
export function markCanvasFrame(frame: THREE.Object3D): void {
  canvasFrames.add(frame);
}

/** The frame of the canvas `object` draws in, null on the root canvas, found up its ancestors. */
export function canvasFrameOf(object: THREE.Object3D): THREE.Object3D | null {
  for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
    if (canvasFrames.has(ancestor)) return ancestor;
  }
  return null;
}
