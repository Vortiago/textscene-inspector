/**
 * The one value that the mounted components of a scene share, such as the reflection probes or the
 * decals of that scene. The first holder makes it, the last one to let go disposes it.
 */

import type * as THREE from 'three';

/** A scene's value and the components that hold it. */
interface Held<Value> {
  value: Value;
  /** In mount order, so the first is the one that drives. */
  holders: Set<symbol>;
}

/**
 * Keeps one `Value` for each scene that has a holder.
 *
 * @canonical A value that a scene's mounted components share
 */
export class SceneHolding<Value extends { dispose(): void }> {
  /** Written only by `hold` and its release. A scene's entry leaves with its last holder. */
  private readonly held = new WeakMap<THREE.Scene, Held<Value>>();

  constructor(private readonly make: (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => Value) {}

  /** Holds the value of `scene` for `holder`, and answers the call that lets go. */
  hold(scene: THREE.Scene, renderer: THREE.WebGLRenderer, holder: symbol): () => void {
    const held = this.held.get(scene) ?? { value: this.make(scene, renderer), holders: new Set<symbol>() };
    this.held.set(scene, held);
    held.holders.add(holder);
    return () => {
      held.holders.delete(holder);
      if (held.holders.size > 0) return;
      held.value.dispose();
      this.held.delete(scene);
    };
  }

  /** The value of `scene`, or undefined while nothing holds it. */
  of(scene: THREE.Scene): Value | undefined {
    return this.held.get(scene)?.value;
  }

  /** Whether `holder` is the first that still holds `scene`'s value, so it alone does the per-frame work. */
  isDriver(scene: THREE.Scene, holder: symbol): boolean {
    return this.held.get(scene)?.holders.values().next().value === holder;
  }
}
