/** Utilities for manipulating node paths in the scene tree. */

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
 */
export function resolveRelativePath(basePath: string, relative: string): string | null {
  const segments = basePath.split('/');
  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      segments.pop();
      if (segments.length === 0) return null;
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
 */
export function resolveNodePathLiteral(basePath: string, raw: string | undefined): string | null {
  if (!raw) return null;
  const match = /NodePath\(\s*"([^"]*)"\s*\)/.exec(raw);
  const inner = (match?.[1] ?? raw).trim();
  if (inner === '' || inner === '.') return null;
  // Absolute paths (`/root/…`) address the LIVE tree, which a static parse does not
  // model, so they are unsupported rather than wrong.
  if (inner.startsWith('/')) return null;
  return resolveRelativePath(basePath, inner);
}
