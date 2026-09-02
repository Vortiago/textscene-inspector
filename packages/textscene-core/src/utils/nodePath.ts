/** Utilities for manipulating node paths in the scene tree. */

import { nodePathLiteral } from '../godot/variantParser.js';
import { UNIQUE_NODE_PREFIX } from './uniqueNames.js';

export function joinPath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
}

export function getAncestorPaths(nodePath: string): string[] {
  const parts = nodePath.split('/');
  const ancestors: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
  }

  return ancestors;
}

/**
 * Resolve a relative node path against a base node's own path, Godot-style: `..` steps up
 * one level, `.` and empty segments are skipped, anything else descends.
 *
 * The base is the node ITSELF, not its parent, so `"Child"` addresses a child and
 * `"../Sibling"` addresses a sibling. Returns null if the path walks above the root.
 *
 * A `%Name` segment is a JUMP, not a descent: `get_node_or_null` looks the name up in
 * the owner's claim table and continues from whatever node it finds (node.cpp:1930-1938),
 * so the walk restarts at the claimed path and a following `..` steps up from THERE.
 * Callers that hold no claim table cannot resolve one, and null is the honest answer —
 * see {@link resolveNodePathLiteral}.
 */
export function resolveRelativePath(
  basePath: string,
  relative: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  let segments = basePath.split('/');
  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      segments.pop();
      if (segments.length === 0) return null;
      continue;
    }
    if (part.startsWith(UNIQUE_NODE_PREFIX)) {
      const claimed = uniquePaths?.get(part);
      if (!claimed) return null;
      segments = claimed.split('/');
      continue;
    }
    segments.push(part);
  }
  return segments.length > 0 ? segments.join('/') : null;
}

/**
 * Resolve a raw TSCN `NodePath("…")` literal, written on the node at `basePath`, to an
 * absolute path in the parsed tree. Returns null when it does not address another node.
 *
 * Shared by every scene-wide pass that follows a NodePath: RemoteTransform3D/2D's
 * `remote_path` and CSGPolygon3D's `path_node`. One definition, because two copies of
 * relative-path arithmetic would drift and the difference would only surface on a scene
 * that actually used `..`.
 *
 * `uniquePaths` maps `%Name` to the path claiming it — build it with `uniqueNameClaims`
 * over the same tree the caller resolves against. Without it a `%Name` resolves to null
 * rather than to a path no node can occupy: `%` is an invalid node-name character
 * (ustring.cpp:5071), so treating the segment as an ordinary child produced a lookup
 * that could never hit.
 */
export function resolveNodePathLiteral(
  basePath: string,
  raw: string | undefined,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  const inner = relativePathText(raw);
  return inner === null ? null : resolveRelativePath(basePath, inner, uniquePaths);
}

/**
 * A literal's path text, or null when it addresses no node in this file BY
 * CONSTRUCTION rather than by failing: an absent value, `.`, and an absolute
 * `/root/…` path, which measures from the live SceneTree a static parse does not
 * model.
 */
function relativePathText(raw: string | undefined): string | null {
  if (!raw) return null;
  // Whole property values arrive here; text that is neither spelling is taken
  // as the path itself.
  const inner = (nodePathLiteral(raw) ?? raw).trim();
  if (inner === '' || inner === '.') return null;
  if (inner.startsWith('/')) return null;
  return inner;
}

/**
 * The `%Name` segments this literal names that nothing claims — the reason a
 * resolve returned null on a path the file plainly meant to address a node with.
 *
 * Callers that report a dangling path need this to tell the two nulls apart: the
 * paths above address nothing deliberately and are never reported here.
 */
export function unclaimedUniqueNames(
  raw: string | undefined,
  uniquePaths?: ReadonlyMap<string, string>
): string[] {
  const inner = relativePathText(raw);
  if (inner === null) return [];
  return inner
    .split('/')
    .filter((segment) => segment.startsWith(UNIQUE_NODE_PREFIX) && !uniquePaths?.has(segment));
}
