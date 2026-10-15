/** Reads one node of the live scene tree, for tests that only need the collapsed node at a path. */
import type { TscnNode } from '../parser/types';
import { resolveLiveEntry, type LiveTreeContext } from './liveSceneTree';

/** The collapsed node at `path`, or null when a segment does not resolve. */
export function liveNodeAt(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext) {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
}
