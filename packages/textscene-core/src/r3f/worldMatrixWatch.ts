/**
 * Tells a per-render hook whether the objects it draws from moved since its last write. It compares
 * the world matrix terms a 2D transform reads, of each object and of the frame of its canvas, so a
 * render where nothing moved builds no transform. The frame is found on each call: an object moved
 * under another canvas keeps its lookup, and a cached frame would go stale.
 */

import type * as THREE from 'three';
import { canvasFrameOf } from './canvasFrame';

/** The world matrix terms a 2D transform reads: the x and y columns and the origin. */
const TRANSFORM_2D_ELEMENTS = [0, 1, 4, 5, 12, 13] as const;

/** The terms of an object's own matrix and of its canvas frame's. */
const TERMS_PER_OBJECT = 2 * TRANSFORM_2D_ELEMENTS.length;

/**
 * Whether the world matrices of a set of objects, and of their canvas frames, moved since the last call.
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
    const length = objects.length * TERMS_PER_OBJECT;
    let isMoved = this.isStale;
    this.isStale = false;
    if (this.reading.length !== length) {
      this.reading = new Float64Array(length);
      this.seen = new Float64Array(length);
      isMoved = true;
    }
    let at = 0;
    for (const object of objects) {
      const frame = object && canvasFrameOf(object);
      for (const element of TRANSFORM_2D_ELEMENTS)
        this.reading[at++] = object?.matrixWorld.elements[element] ?? 0;
      for (const element of TRANSFORM_2D_ELEMENTS)
        this.reading[at++] = frame?.matrixWorld.elements[element] ?? 0;
    }
    for (let i = 0; i < at && !isMoved; i++) isMoved = this.reading[i] !== this.seen[i];
    const seen = this.seen;
    this.seen = this.reading;
    this.reading = seen;
    return isMoved;
  }

  /** Makes the next {@link hasMoved} true. */
  forget(): void {
    this.isStale = true;
  }
}
