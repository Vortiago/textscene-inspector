/**
 * The objects under a root that carry a `material`, collected by one walk. The root is walked again
 * only after three reports a child added or removed somewhere below it, so a pass that runs every
 * frame reads a flat list instead of traversing the whole scene.
 */

import type * as THREE from 'three';

export class MaterialHolders {
  /** Refilled in place by `collect`, so the list a caller holds stays the current one. */
  private readonly holders: THREE.Object3D[] = [];
  /** Every object that carries this tracker's two listeners. */
  private watched = new Set<THREE.Object3D>();
  /** Set by a listener, cleared by `collect`. */
  private stale = true;

  private readonly markStale = (): void => {
    this.stale = true;
  };

  constructor(private readonly root: THREE.Object3D) {}

  /**
   * The holders under the root, in `traverse` order. Walks the root only when the tree changed
   * since the last call: `Object3D.add`, `attach` and `remove` all dispatch `childadded` or
   * `childremoved` on the parent (`Object3D.js`), and so does R3F's own `insertBefore`.
   */
  current(): readonly THREE.Object3D[] {
    if (this.stale) this.collect();
    return this.holders;
  }

  /** Removes every listener. A later `current()` walks the root afresh. */
  dispose(): void {
    for (const object of this.watched) this.unwatch(object);
    this.watched.clear();
    this.holders.length = 0;
    this.stale = true;
  }

  private collect(): void {
    const reached = new Set<THREE.Object3D>();
    this.holders.length = 0;
    this.root.traverse((object) => {
      reached.add(object);
      if (!this.watched.has(object)) this.watch(object);
      // Every drawable (Mesh, Line, Points, Sprite) sets `material` in its constructor, so
      // a later swap on one is an assignment to a holder already in the list.
      if ((object as Partial<THREE.Mesh>).material !== undefined) this.holders.push(object);
    });
    // An object that left the tree drops its listeners, so the tracker never holds it.
    for (const object of this.watched) {
      if (!reached.has(object)) this.unwatch(object);
    }
    this.watched = reached;
    this.stale = false;
  }

  private watch(object: THREE.Object3D): void {
    object.addEventListener('childadded', this.markStale);
    object.addEventListener('childremoved', this.markStale);
  }

  private unwatch(object: THREE.Object3D): void {
    object.removeEventListener('childadded', this.markStale);
    object.removeEventListener('childremoved', this.markStale);
  }
}
