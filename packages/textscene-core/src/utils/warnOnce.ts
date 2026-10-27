/** Logs a warning once for each owner and key, for a path that runs on every pass or rebuild. */

import { warn } from '../logger';
import { perObject } from './perObject';

const warnedKeys = perObject((): Set<string> => new Set());

/**
 * Warns with `message` the first time `owner` asks for `key`, then stays quiet. The owner decides
 * how long the silence lasts: a WeakMap entry ends with it, and a module constant lasts the session.
 *
 * @oneWay A warning that must appear once, not on every pass or rebuild
 */
export function warnOnce(owner: object, key: string, message: string): void {
  const warned = warnedKeys(owner);
  if (warned.has(key)) return;
  warned.add(key);
  warn(message);
}
