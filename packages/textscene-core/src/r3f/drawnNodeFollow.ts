/**
 * Follows the drawn objects at a list of live paths across renders: it finds them through the
 * node-object registry, keeps the lookup while it holds, and tells whether one of them moved since
 * the last render that asked. The Skeleton2D pose and the Bone2D kites each follow drawn nodes
 * this way.
 */

import type * as THREE from 'three';
import { lookupDrawnObjects, type DrawnObjects } from './drawnObjects.js';
import { WorldMatrixWatch } from './worldMatrixWatch.js';

/**
 * The drawn objects at live paths, and whether they moved.
 *
 * @canonical Follow the drawn objects at live paths across renders
 */
export class DrawnNodeFollow {
  /** Written only by {@link objects}, each time the lookup finds other objects. */
  private drawn: DrawnObjects | null = null;
  /** Written only by {@link objects} with `drawn`: null while a path has no drawn object. */
  private found: readonly THREE.Object3D[] | null = null;
  private readonly watch = new WorldMatrixWatch();

  constructor(
    private readonly registry: ReadonlyMap<string, THREE.Object3D>,
    private readonly paths: readonly string[]
  ) {}

  /** The drawn object at each path, in order, or null while one of them is not drawn. */
  objects(): readonly THREE.Object3D[] | null {
    const drawn = lookupDrawnObjects(this.registry, this.paths, this.drawn);
    if (drawn !== this.drawn) {
      this.drawn = drawn;
      const isWhole = drawn.objects.every((object) => object !== null);
      this.found = isWhole ? (drawn.objects as readonly THREE.Object3D[]) : null;
      this.watch.forget();
    }
    return this.found;
  }

  /**
   * Whether an object of `objects`, the answer {@link objects} gave this render, moved since the
   * last call, and always true for the first call with other objects.
   */
  hasMoved(objects: readonly THREE.Object3D[]): boolean {
    return this.watch.hasMoved(objects);
  }
}
