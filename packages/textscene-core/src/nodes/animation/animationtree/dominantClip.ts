/**
 * The dominant clip of a blend program: the single read-only transport entry an AnimationTree
 * shows, since Godot's Animation panel has no clip picker for one, and its live playhead.
 */

import type { AnimationAction } from 'three';

/** The heaviest clip of `program`, the first of equals, or null for an empty program. */
export function dominantClip<C extends { readonly weight: number }>(program: readonly C[]): C | null {
  return program.reduce<C | null>((best, c) => (best === null || c.weight > best.weight ? c : best), null);
}

/**
 * The dominant clip's live playhead, the `liveTime` for `stepPlayback`. `null` means no live
 * playhead to flush, never a fabricated `0`: a blend program can name a clip the driver lacks, so
 * `dominant` is set but `actions` has no entry. A `0` there would snap the paused readout to zero
 * on the next playing-to-paused edge.
 */
export function dominantActionTime(
  dominant: { clip: string } | null,
  actions: ReadonlyMap<string, AnimationAction>
): number | null {
  if (!dominant) return null;
  return actions.get(dominant.clip)?.time ?? null;
}
