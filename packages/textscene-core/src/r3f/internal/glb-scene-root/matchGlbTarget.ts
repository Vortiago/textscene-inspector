/**
 * Resolve a Godot node path onto a loaded GLB's THREE graph.
 *
 * The two sides come from DIFFERENT importers, so string equality is not enough.
 * Godot's glTF importer synthesises a `Skeleton3D` between an armature and the
 * mesh it skins; three's loader does not. `player.glb` really contains
 * `Skeleton/Robot`, while `player.tscn` addresses that mesh as
 * `Player/Skeleton/Skeleton3D/Robot`. Matching only exactly would work on Truck
 * Town's terrain — which does line up 1:1 — and silently fail on the player,
 * the enemy and the ragdoll, i.e. most of the scenes this exists for.
 *
 * So the rule is: the three path must be an ordered SUBSEQUENCE of the Godot
 * path, ending at the same name. That admits levels Godot invented and nothing
 * else — in particular it never matches a same-named node on an unrelated
 * branch, which a bare-name lookup would.
 *
 * Paths are the `relPath` scheme `glbHierarchy` already produces, so a match
 * lines up with the rows the scene tree shows and the objects selection
 * registers.
 */

import type { GlbObjectEntry } from './glbHierarchy.js';
import { info, warn } from '../../../logger.js';

/**
 * The GLB object a Godot path names, or `null` when the graph has nothing that
 * could be it.
 *
 * @param entries the GLB flattened by `flattenGlbObjects`
 * @param godotPath the path RELATIVE to the GLB root, e.g. `Skeleton/Skeleton3D/Robot`
 */
export function matchGlbTarget(
  entries: readonly GlbObjectEntry[],
  godotPath: string
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

  // The node itself has no counterpart — `Skeleton3D` exists only in Godot's
  // tree. The nearest ancestor that DOES match is the object it must have meant.
  for (let depth = segments.length - 1; depth > 0; depth--) {
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
 * The deepest entry whose path is an ordered subsequence of `segments` and ends
 * at the same name. Deepest wins because it shares the most with the authored
 * path; ties resolve by `relPath` so the answer is deterministic.
 */
function bestSubsequenceMatch(
  entries: readonly GlbObjectEntry[],
  segments: readonly string[]
): GlbObjectEntry | null {
  const last = segments[segments.length - 1];
  const candidates = entries
    .filter((e) => {
      const own = e.relPath.split('/');
      return own[own.length - 1] === last && isOrderedSubsequence(own, segments);
    })
    .sort((a, b) => {
      const depth = b.relPath.split('/').length - a.relPath.split('/').length;
      return depth !== 0 ? depth : a.relPath.localeCompare(b.relPath);
    });

  return candidates[0] ?? null;
}

/** Whether every segment of `inner` appears in `outer`, in order. */
function isOrderedSubsequence(inner: readonly string[], outer: readonly string[]): boolean {
  let i = 0;
  // Once `i` reaches the end, `inner[i]` is undefined and matches nothing, so
  // the counter stops climbing on its own — no in-loop exit needed.
  for (const segment of outer) if (segment === inner[i]) i++;
  return i === inner.length;
}
