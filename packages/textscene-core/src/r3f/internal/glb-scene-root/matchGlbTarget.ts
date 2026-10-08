/**
 * Resolves a Godot node path on a loaded GLB's THREE graph, in `glbHierarchy`'s `relPath` scheme.
 * Godot's importer synthesises a `Skeleton3D` and BoneAttachment3Ds that three's does not, and
 * keeps most bones out of its tree, so an object's `godotSegments` must be an ordered subsequence
 * of the Godot path that ends at the same name. That admits the levels Godot invented and never a
 * same-named node on an unrelated branch.
 */

import type { GlbObjectEntry } from './glbHierarchy.js';
import { info, warn } from '../../../logger.js';

export interface MatchGlbTargetOptions {
  /**
   * Fall back to the nearest ancestor when the leaf itself has no counterpart.
   * Off for a per-instance property (a render-layer mask), which an ancestor would
   * spread over every sibling under it.
   */
  allowAncestor?: boolean;
}

/**
 * The GLB object a Godot path names, or `null` when nothing could be it.
 *
 * @param entries the GLB flattened by `flattenGlbObjects`
 * @param godotPath the path relative to the GLB root, such as `Skeleton/Skeleton3D/Robot`
 */
export function matchGlbTarget(
  entries: readonly GlbObjectEntry[],
  godotPath: string,
  { allowAncestor = true }: MatchGlbTargetOptions = {}
): GlbObjectEntry | null {
  const exact = entries.find((e) => e.relPath === godotPath);
  if (exact) return exact;

  const segments = godotPath.split('/');

  const subsequence = bestSubsequenceMatch(entries, segments);
  if (subsequence) {
    info(
      `[matchGlbTarget] "${godotPath}" → "${subsequence.relPath}" (levels Godot's importer added are not in the glTF)`
    );
    return subsequence;
  }

  // The node has no counterpart, as `Skeleton3D` exists only in Godot's tree. The nearest
  // ancestor that matches is the object it means.
  for (let depth = segments.length - 1; allowAncestor && depth > 0; depth--) {
    // No exact-match fast path here: an exact hit is itself the deepest
    // possible subsequence match, so `bestSubsequenceMatch` already returns it.
    const match = bestSubsequenceMatch(entries, segments.slice(0, depth));
    if (match) {
      info(
        `[matchGlbTarget] "${godotPath}" has no counterpart; using its nearest ancestor "${match.relPath}"`
      );
      return match;
    }
  }

  warn(
    `[matchGlbTarget] "${godotPath}" matches nothing in the loaded GLB — the override it carries is dropped`
  );
  return null;
}

/**
 * The entry whose Godot segments are an ordered subsequence of `segments` and end at the same
 * name, sharing the most with the authored path. A tie goes to the deepest, then by `relPath`, so
 * the answer is deterministic.
 */
function bestSubsequenceMatch(
  entries: readonly GlbObjectEntry[],
  segments: readonly string[]
): GlbObjectEntry | null {
  const last = segments[segments.length - 1];
  const candidates = entries
    .filter(
      (e) =>
        e.godotSegments[e.godotSegments.length - 1] === last &&
        isOrderedSubsequence(e.godotSegments, segments)
    )
    .sort((a, b) => {
      const shared = b.godotSegments.length - a.godotSegments.length;
      if (shared !== 0) return shared;
      const depth = b.relPath.split('/').length - a.relPath.split('/').length;
      return depth !== 0 ? depth : a.relPath.localeCompare(b.relPath);
    });

  return candidates[0] ?? null;
}

/** Whether every segment of `inner` appears in `outer`, in order. */
function isOrderedSubsequence(inner: readonly string[], outer: readonly string[]): boolean {
  let i = 0;
  // Past the end, `inner[i]` is undefined and matches nothing, so the counter stops by itself.
  for (const segment of outer) if (segment === inner[i]) i++;
  return i === inner.length;
}
