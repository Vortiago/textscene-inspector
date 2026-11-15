/**
 * Keeps the result a scene pass gave a node at a live path while the next result equals it, so a
 * load that changes nothing hands each reader the object it already holds and re-renders nothing.
 */

import { perObject } from '../utils/perObject.js';
import { sameData } from '../utils/sameData.js';

/**
 * A function that gives `value`, or the equal one the node had at `path` before. The table hangs
 * off the node, so it is collected with it, and a node shared by several instances keeps one value
 * for each live path.
 *
 * @canonical Keep the equal result a node had at a live path
 */
export function keptPerLivePath<T>(
  isSame: (previous: T, value: T) => boolean = sameData
): (node: object, path: string, value: T) => T {
  const tableOf = perObject(() => new Map<string, T>());
  return (node, path, value) => {
    const table = tableOf(node);
    const previous = table.get(path);
    if (previous !== undefined && isSame(previous, value)) return previous;
    table.set(path, value);
    return value;
  };
}
