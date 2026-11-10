/**
 * Tells a per-render hook whether the objects it draws from moved since its last write. It compares
 * the world matrix terms a 2D transform reads, so a render where nothing moved builds no transform.
 */

import type * as THREE from 'three';
import { canvasFrameOf } from './canvasFrame';

/** The world matrix terms a 2D transform reads: the x and y columns and the origin. */
const TRANSFORM_2D_ELEMENTS = [0, 1, 4, 5, 12, 13] as const;

/**
 * The objects to watch for a 2D transform: `objects`, then the frame of each canvas that
 * `canvasTransformInto` reads them in, once each.
 */
export function withCanvasFrames(objects: readonly (THREE.Object3D | null)[]): (THREE.Object3D | null)[] {
  const frames = new Set<THREE.Object3D>();
  for (const object of objects) {
    const frame = object && canvasFrameOf(object);
    if (frame) frames.add(frame);
  }
  return [...objects, ...frames];
}

/**
 * Whether the world matrices of a set of objects moved since the last call.
 *
 * @canonical Whether drawn 2D objects moved since the last write
 */
export class WorldMatrixWatch {
  /** The terms at the last call. Two buffers swap, so a call allocates none once the size is steady. */
  private seen = new Float64Array(0);
  private reading = new Float64Array(0);
  private isStale = true;

  /**
   * Whether a world matrix of `objects` differs from the last call, and always true for the first
   * call, after {@link forget}, or when the object count changes. A null object reads as zeros.
   */
  hasMoved(objects: readonly (THREE.Object3D | null)[]): boolean {
    const length = objects.length * TRANSFORM_2D_ELEMENTS.length;
    let isMoved = this.isStale;
    this.isStale = false;
    if (this.reading.length !== length) {
      this.reading = new Float64Array(length);
      this.seen = new Float64Array(length);
      isMoved = true;
    }
    let at = 0;
    for (const object of objects) {
      for (const element of TRANSFORM_2D_ELEMENTS)
        this.reading[at++] = object?.matrixWorld.elements[element] ?? 0;
    }
    for (let i = 0; i < at && !isMoved; i++) isMoved = this.reading[i] !== this.seen[i];
    [this.seen, this.reading] = [this.reading, this.seen];
    return isMoved;
  }

  /** Makes the next {@link hasMoved} true. */
  forget(): void {
    this.isStale = true;
  }
}
