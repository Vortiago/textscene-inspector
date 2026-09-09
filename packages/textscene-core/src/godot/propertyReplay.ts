/**
 * The order Godot applies a node's stored properties in.
 *
 * `SceneState::instantiate` walks a node's stored properties in the order the
 * FILE lists them (`packed_scene.cpp:369-492`, over the list
 * `resource_format_text.cpp:304` appends to as it scans). The order a class's
 * `_bind_methods` declares them in is the order Godot SAVES in, and binds
 * nothing a hand-authored body has to follow.
 *
 * That matters wherever one property's setter guards against another's value:
 * the guard sees only what the lines ABOVE it have already applied. Measured on
 * 4.6.3 with a Sprite2D body of `frame = 3` then `hframes = 4`: `set_frame`'s
 * `ERR_FAIL_INDEX` fires against a grid of 1 and the sprite loads on frame 0.
 */

/** Where a key sits relative to another in the file's own order. */
export interface ReplayPosition {
  /** The key's value, when it is listed ABOVE `subject`. */
  applied: string | undefined;
  /** The key is listed BELOW `subject`, so its value is not in effect yet. */
  late: boolean;
}

/**
 * Where each of `names` sits relative to `subject`, by the file's order.
 *
 * `rawProperties` preserves insertion order, which is the file's, so this reads
 * the replay order directly rather than reconstructing it. A name the file does
 * not carry answers `{ applied: undefined, late: false }` — absent, not late.
 */
export function replayPositions(
  properties: Record<string, string>,
  subject: string,
  names: readonly string[]
): Record<string, ReplayPosition> {
  const wanted = new Set(names);
  const out: Record<string, ReplayPosition> = {};
  for (const name of names) out[name] = { applied: undefined, late: false };
  let seenSubject = false;
  for (const [key, value] of Object.entries(properties)) {
    if (key === subject) {
      seenSubject = true;
      continue;
    }
    if (!wanted.has(key)) continue;
    out[key] = seenSubject ? { applied: undefined, late: true } : { applied: value, late: false };
  }
  return out;
}
