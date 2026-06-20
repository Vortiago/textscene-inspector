/**
 * Non-transform value-track support for AnimationPlayer — currently `frame`
 * (sprite-sheet flipbook). THREE's AnimationMixer drives transforms only
 * (ADR-0011), so discrete property values like `frame` are sampled here and
 * pushed to the target component through the AnimatedFrame registry (ADR-0016),
 * the scoped "value-push" path ADR-0011 deferred.
 */

import type { GodotKeyframe } from './animationResolver';

/**
 * The value held at `time` by a stepped (discrete) value track: the last
 * keyframe at or before `time` — Godot holds a discrete value (like a sprite
 * `frame`) until the next key. Returns the first key's value before the track
 * starts, and 0 for an empty track.
 */
export function sampleSteppedValue(keys: readonly GodotKeyframe[], time: number): number {
  if (keys.length === 0) return 0;
  let value = numericValue(keys[0]!.value);
  for (const key of keys) {
    if (key.time <= time) value = numericValue(key.value);
    else break; // keys are authored time-ascending (Godot/THREE both require it)
  }
  return value;
}

/** A `frame` keyframe is an integer; coerce defensively so a malformed array/
 *  boolean value degrades to 0 rather than poisoning the UV math with NaN. */
function numericValue(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Resolve a value track's relative target (e.g. `Sprite2D`) to an absolute node
 * path, given the player's own path and its `root_node` (default `..` = the
 * player's parent), so it can be matched against the target node's own path.
 */
export function resolveTargetNodePath(
  playerNodePath: string,
  rootNodeRaw: string,
  relativeTarget: string
): string {
  const rootRelative = rootNodeRaw ? nodePathInner(rootNodeRaw) : '..';
  const rootAbsolute = applyRelativePath(playerNodePath, rootRelative);
  return applyRelativePath(rootAbsolute, relativeTarget);
}

/** Extract the inner path of a `NodePath("…")` literal (or pass through a bare path). */
function nodePathInner(raw: string): string {
  const match = raw.match(/NodePath\(\s*"([^"]*)"\s*\)/);
  return match ? match[1]! : raw;
}

/** Apply a relative node path (`..`/`.`/names) onto an absolute base path. */
function applyRelativePath(base: string, relative: string): string {
  const segments = base ? base.split('/') : [];
  for (const seg of relative.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') segments.pop();
    else segments.push(seg);
  }
  return segments.join('/');
}
