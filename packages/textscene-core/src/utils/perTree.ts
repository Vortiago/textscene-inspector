/** A table built once for each parsed tree, keyed by its roots array. */

import type { RawNode } from '../parser/types.js';

/**
 * A reader that builds its table once for each roots array it is called with. The key is the
 * array's identity: a parse makes a fresh array and nothing mutates a tree in place, so an entry
 * never goes stale, and the WeakMap lets it be collected with its tree.
 */
export function perTree<T>(build: (roots: readonly RawNode[]) => T): (roots: readonly RawNode[]) => T {
  const built = new WeakMap<readonly RawNode[], T>();
  return (roots) => {
    // `has` only on a miss: a build may return undefined, and that is a table too.
    const table = built.get(roots);
    if (table !== undefined || built.has(roots)) return table as T;
    const fresh = build(roots);
    built.set(roots, fresh);
    return fresh;
  };
}
