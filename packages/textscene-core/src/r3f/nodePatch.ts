/**
 * What a live scene pass binds into a node of the Live scene tree: property values laid over the
 * node, by its live path. A sub-scene's nodes are shared by every instance of it, so a pass never
 * writes into a node (ADR-0060).
 */

import type { TscnNode } from '../parser/types.js';

/** The property values that replace a node's own. */
export type NodePatch = Readonly<Record<string, unknown>>;

/** A patch for each live node path that has one. */
export type NodePatches = ReadonlyMap<string, NodePatch>;

export const NO_PATCHES: NodePatches = new Map();

/** What a reader of node poses asks of the patches: the patch at a live path. */
export interface PatchLookup {
  get(path: string): NodePatch | undefined;
}

/** `top` laid over `base`: the patch `top` holds for a path replaces the one of `base`. */
export function layeredPatches(base: PatchLookup, top: PatchLookup): PatchLookup {
  return { get: (path) => top.get(path) ?? base.get(path) };
}

/** `node` with `patch` laid over its properties, and `node` itself where there is no patch. */
export function patchedNode<N extends TscnNode>(node: N, patch: NodePatch | undefined): N {
  return patch ? { ...node, properties: { ...node.properties, ...patch } } : node;
}
