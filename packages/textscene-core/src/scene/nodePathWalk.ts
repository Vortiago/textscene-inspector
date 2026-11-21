import { nodePathWalkNames, UNIQUE_NODE_PREFIX } from '../godot/string/nodePath.js';
import { parentPathOf } from '../utils/nodePath.js';

/** The root window's absolute path, which holds the scene's root node as its child. */
export const ROOT_WINDOW_PATH = '/root';
const ROOT_WINDOW_NAME = 'root';
export const ROOT_WINDOW_PREFIX = `${ROOT_WINDOW_PATH}/`;

/** The path the Live scene tree and the canvas name a node by: its absolute path without `/root/`. */
export function livePathOf(path: string): string {
  return path.slice(ROOT_WINDOW_PREFIX.length);
}

/** Null for no path and for the root window, which no canvas node stands for. */
export function liveNodePathOf(path: string | undefined): string | null {
  return path?.startsWith(ROOT_WINDOW_PREFIX) ? livePathOf(path) : null;
}

export function absolutePathOf(livePath: string): string {
  return `${ROOT_WINDOW_PREFIX}${livePath}`;
}

/** What the walk reads of the tree, every node named by its absolute path. */
export interface WalkedTree {
  childNames(path: string): readonly string[] | null;
  /** The `%Name` table a NodePath on the node at `path` reads, `%Name` to absolute path. */
  uniquePaths(path: string): ReadonlyMap<string, string>;
}

function parentOf(path: string): string | null {
  if (path === ROOT_WINDOW_PATH) return null;
  return parentPathOf(path);
}

function childOf(tree: WalkedTree, path: string, name: string): string | null {
  return tree.childNames(path)?.includes(name) ? `${path}/${name}` : null;
}

/** The step from `current` to `name`, or undefined where the walk returns nullptr at once. */
function step(tree: WalkedTree, current: string | null, name: string): string | null | undefined {
  if (name === '.') return current;
  if (name === '..') return (current && parentOf(current)) ?? undefined;
  if (current === null) return name === ROOT_WINDOW_NAME ? ROOT_WINDOW_PATH : null;
  if (name.startsWith(UNIQUE_NODE_PREFIX)) return tree.uniquePaths(current).get(name) ?? undefined;
  return childOf(tree, current, name) ?? undefined;
}

/** `node.cpp:1892-1952` from the node at absolute path `from`: the absolute path `path` names, or null. */
export function getNodeOrNull(tree: WalkedTree, from: string, path: string): string | null {
  if (path === '') return null;
  let current: string | null = path.startsWith('/') ? null : from;
  for (const name of nodePathWalkNames(path)) {
    const next = step(tree, current, name);
    if (next === undefined) return null;
    current = next;
  }
  return current;
}
