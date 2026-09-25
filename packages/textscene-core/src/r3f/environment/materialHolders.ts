/**
 * The objects under a root that carry a `material`, kept in a flat list for a pass that runs every
 * frame. The first read walks the root. After that, only a subtree three reports added or removed
 * below the root is walked, so no frame and no arrival traverses the whole scene.
 */

import type * as THREE from 'three';

/** The payload three dispatches with `childadded` and `childremoved` (`Object3D.js`). */
interface ChildEvent {
  child: THREE.Object3D;
}

export class MaterialHolders {
  /** Edited in place by `track` and `untrack`, so the list a caller holds stays the current one. */
  private readonly holders: THREE.Object3D[] = [];
  /** Each holder's position in `holders`, so a removal swaps with the last entry in O(1). */
  private readonly holderIndex = new Map<THREE.Object3D, number>();
  /** Every object that carries this tracker's two listeners. */
  private readonly watched = new Set<THREE.Object3D>();
  /** Set by the first `current()`, cleared by `dispose`. */
  private hasWalkedRoot = false;

  private readonly onChildAdded = (event: ChildEvent): void => this.track(event.child);
  private readonly onChildRemoved = (event: ChildEvent): void => this.untrack(event.child);

  constructor(private readonly root: THREE.Object3D) {}

  /**
   * The holders under the root, in no particular order. `Object3D.add`, `attach` and `remove`
   * all dispatch `childadded` or `childremoved` on the parent (`Object3D.js`), and so does R3F's
   * own `insertBefore`, so the list follows every change without a walk of the root.
   */
  current(): readonly THREE.Object3D[] {
    if (!this.hasWalkedRoot) {
      this.track(this.root);
      this.hasWalkedRoot = true;
    }
    return this.holders;
  }

  /** Removes every listener. A later `current()` walks the root afresh. */
  dispose(): void {
    for (const object of this.watched) this.unwatch(object);
    this.watched.clear();
    this.holders.length = 0;
    this.holderIndex.clear();
    this.hasWalkedRoot = false;
  }

  private track(subtree: THREE.Object3D): void {
    subtree.traverse((object) => {
      if (this.watched.has(object)) return;
      this.watched.add(object);
      object.addEventListener('childadded', this.onChildAdded);
      object.addEventListener('childremoved', this.onChildRemoved);
      // Every drawable (Mesh, Line, Points, Sprite) sets `material` in its constructor, so
      // a later swap on one is an assignment to a holder already in the list.
      if ((object as Partial<THREE.Mesh>).material === undefined) return;
      this.holderIndex.set(object, this.holders.length);
      this.holders.push(object);
    });
  }

  private untrack(subtree: THREE.Object3D): void {
    subtree.traverse((object) => {
      if (!this.watched.delete(object)) return;
      this.unwatch(object);
      this.removeHolder(object);
    });
  }

  private removeHolder(object: THREE.Object3D): void {
    const index = this.holderIndex.get(object);
    if (index === undefined) return;
    this.holderIndex.delete(object);
    const last = this.holders.pop()!;
    if (last === object) return;
    this.holders[index] = last;
    this.holderIndex.set(last, index);
  }

  private unwatch(object: THREE.Object3D): void {
    object.removeEventListener('childadded', this.onChildAdded);
    object.removeEventListener('childremoved', this.onChildRemoved);
  }
}
