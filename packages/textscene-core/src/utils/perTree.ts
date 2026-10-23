/** A table built once for each parsed tree, keyed by its roots array. */

import type { RawNode } from '../parser/types.js';
import { perObject } from './perObject.js';

/**
 * {@link perObject} keyed by a roots array. A parse makes a fresh array and nothing mutates a tree
 * in place, so an entry never goes stale.
 */
export function perTree<T>(build: (roots: readonly RawNode[]) => T): (roots: readonly RawNode[]) => T {
  return perObject(build);
}
