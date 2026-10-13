/**
 * The objects of one kind under a root, kept in a flat list for a pass that runs every render. The
 * first read walks the root. After that, only a subtree three reports added or removed below the
 * root is walked, so no render and no arrival traverses the whole scene.
 */

import type * as THREE from 'three';

/** The payload three dispatches with `childadded` and `childremoved` (`Object3D.js`). */
interface ChildEvent {
  child: THREE.Object3D;
}

export class TrackedObjects<Tracked extends THREE.Object3D> {
  /** Edited in place by `track` and `untrack`, so the list a caller holds stays the current one. */
  private readonly tracked: Tracked[] = [];
  /** Each object's position in `tracked`, so a removal swaps with the last entry in O(1). */
  private readonly trackedIndex = new Map<THREE.Object3D, number>();
  /** Every object that carries this tracker's two listeners. */
  private readonly watched = new Set<THREE.Object3D>();
  /** Set by the first `current()`, cleared by `dispose`. */
  private hasWalkedRoot = false;

  private readonly onChildAdded = (event: ChildEvent): void => this.track(event.child);
  private readonly onChildRemoved = (event: ChildEvent): void => this.untrack(event.child);

  /** `isTracked` must answer the same for an object for as long as it is under the root. */
  constructor(
    private readonly root: THREE.Object3D,
    private readonly isTracked: (object: THREE.Object3D) => object is Tracked
  ) {}

  /**
   * The tracked objects under the root, in no particular order. `Object3D.add`, `attach` and `remove`
   * all dispatch `childadded` or `childremoved` on the parent (`Object3D.js`), and so does R3F's
   * own `insertBefore`, so the list follows every change without a walk of the root.
   */
  current(): readonly Tracked[] {
    if (!this.hasWalkedRoot) {
      this.track(this.root);
      this.hasWalkedRoot = true;
    }
    return this.tracked;
  }

  /** Removes every listener. A later `current()` walks the root afresh. */
  dispose(): void {
    for (const object of this.watched) this.unwatch(object);
    this.watched.clear();
    this.tracked.length = 0;
    this.trackedIndex.clear();
    this.hasWalkedRoot = false;
  }

  private track(subtree: THREE.Object3D): void {
    subtree.traverse((object) => {
      if (this.watched.has(object)) return;
      this.watched.add(object);
      object.addEventListener('childadded', this.onChildAdded);
      object.addEventListener('childremoved', this.onChildRemoved);
      if (!this.isTracked(object)) return;
      this.trackedIndex.set(object, this.tracked.length);
      this.tracked.push(object);
    });
  }

  private untrack(subtree: THREE.Object3D): void {
    subtree.traverse((object) => {
      if (!this.watched.delete(object)) return;
      this.unwatch(object);
      this.removeTracked(object);
    });
  }

  private removeTracked(object: THREE.Object3D): void {
    const index = this.trackedIndex.get(object);
    if (index === undefined) return;
    this.trackedIndex.delete(object);
    const last = this.tracked.pop()!;
    if (last === object) return;
    this.tracked[index] = last;
    this.trackedIndex.set(last, index);
  }

  private unwatch(object: THREE.Object3D): void {
    object.removeEventListener('childadded', this.onChildAdded);
    object.removeEventListener('childremoved', this.onChildRemoved);
  }
}

/**
 * Every drawable (Mesh, Line, Points, Sprite) sets `material` in its constructor, so a later swap on
 * one is an assignment to a holder already in the list.
 */
function holdsMaterial(object: THREE.Object3D): object is THREE.Object3D {
  return (object as Partial<THREE.Mesh>).material !== undefined;
}

/** The objects under a root that carry a `material`. */
export class MaterialHolders extends TrackedObjects<THREE.Object3D> {
  constructor(root: THREE.Object3D) {
    super(root, holdsMaterial);
  }
}
