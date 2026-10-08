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
  let best: GlbObjectEntry | null = null;
  for (const entry of entries) {
    const own = entry.godotSegments;
    if (own[own.length - 1] !== last || !isOrderedSubsequence(own, segments)) continue;
    if (!best || ranksAbove(entry, best)) best = entry;
  }
  return best;
}

function ranksAbove(a: GlbObjectEntry, b: GlbObjectEntry): boolean {
  if (a.godotSegments.length !== b.godotSegments.length)
    return a.godotSegments.length > b.godotSegments.length;
  const depthA = a.relPath.split('/').length;
  const depthB = b.relPath.split('/').length;
  return depthA !== depthB ? depthA > depthB : a.relPath.localeCompare(b.relPath) < 0;
}

/** Whether every segment of `inner` appears in `outer`, in order. */
function isOrderedSubsequence(inner: readonly string[], outer: readonly string[]): boolean {
  let i = 0;
  // Past the end, `inner[i]` is undefined and matches nothing, so the counter stops by itself.
  for (const segment of outer) if (segment === inner[i]) i++;
  return i === inner.length;
}
