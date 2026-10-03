/**
 * Which cached resources read which addresses while they built. A Theme resolves its
 * fonts, a Font its `base_font` and fallbacks, and a GLB its **Import sidecar**, inside
 * its own cached value, so a change to what it read must also reach it.
 */

import type { ResourceType } from './ResourceEventBus';
import { resourceFilePath } from './subResourcePath';

/** A cached resource that read another resource: its bus and its cache key. */
export interface Dependent {
  busType: ResourceType;
  key: string;
}

const idOf = (dependent: Dependent): string => `${dependent.busType}\u0000${dependent.key}`;

/** `map[key]`, created empty on first use. */
function setIn<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  return set;
}

/**
 * Written by the processors' reads as a dependent requests what it reads. `release`
 * empties it for the dependents a change reaches, `prune` for those no cache holds,
 * and `clear` entirely.
 */
export class DependencyGraph {
  /** Dependent id → the dependent and the addresses it read. */
  private readonly entries = new Map<string, { dependent: Dependent; addresses: Set<string> }>();
  /** Address → the ids of the dependents that read it. */
  private readonly readersOf = new Map<string, Set<string>>();
  /** File → the addresses in it that a dependent read. */
  private readonly addressesIn = new Map<string, Set<string>>();

  /** `dependent` read `address`, a file or a **Sub-resource path** in one. */
  record(dependent: Dependent, address: string): void {
    const id = idOf(dependent);
    let entry = this.entries.get(id);
    if (!entry) this.entries.set(id, (entry = { dependent, addresses: new Set() }));
    entry.addresses.add(address);
    setIn(this.readersOf, address).add(id);
    setIn(this.addressesIn, resourceFilePath(address)).add(address);
  }

  /**
   * Every dependent a change to `file` reaches, nearest first: the readers of an address
   * in it, then the readers of each reached dependent's own key. One inside `file` is
   * left out, since the clear of `file` covers it. All of these lose their edges.
   */
  release(file: string): Dependent[] {
    const reached = new Map<string, Dependent>();
    const queue = [...(this.addressesIn.get(file) ?? [])];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      for (const id of this.readersOf.get(queue[i]!) ?? []) {
        const { dependent } = this.entries.get(id)!;
        if (reached.has(id) || resourceFilePath(dependent.key) === file) continue;
        reached.set(id, dependent);
        if (!seen.has(dependent.key)) {
          seen.add(dependent.key);
          queue.push(dependent.key);
        }
      }
    }
    for (const id of reached.keys()) this.forget(id);
    for (const [id, { dependent }] of this.entries) {
      if (resourceFilePath(dependent.key) === file) this.forget(id);
    }
    return [...reached.values()];
  }

  /** Drops every dependent `isHeld` refuses: an evicted one would only clear a key nothing holds. */
  prune(isHeld: (dependent: Dependent) => boolean): void {
    for (const [id, { dependent }] of this.entries) {
      if (!isHeld(dependent)) this.forget(id);
    }
  }

  clear(): void {
    this.entries.clear();
    this.readersOf.clear();
    this.addressesIn.clear();
  }

  private forget(id: string): void {
    for (const address of this.entries.get(id)?.addresses ?? []) {
      const readers = this.readersOf.get(address);
      readers?.delete(id);
      if (readers?.size !== 0) continue;
      this.readersOf.delete(address);
      const file = resourceFilePath(address);
      const addresses = this.addressesIn.get(file);
      addresses?.delete(address);
      if (addresses?.size === 0) this.addressesIn.delete(file);
    }
    this.entries.delete(id);
  }
}
