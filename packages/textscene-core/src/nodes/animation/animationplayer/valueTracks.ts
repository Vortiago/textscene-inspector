/**
 * Non-transform value-track support for AnimationPlayer. THREE's AnimationMixer drives transforms
 * only (ADR-0011), so property values like `frame` are sampled here and pushed to the target
 * component through the AnimatedValue registry (ADR-0016).
 */

import type { GodotKeyframe } from './animationResolver';

/**
 * The value a stepped (discrete) value track holds at `time`: the last keyframe at or before
 * `time`, since Godot holds a discrete value until the next key. Returns the first key's value
 * before the track starts, and 0 for an empty track.
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
 * The value of a continuous value track at `time` (ADR-0017): component-wise lerp between the two
 * bracketing keys, holding the endpoint key outside the track. `interp` 0 (nearest) holds the
 * earlier key and any other mode lerps: cubic (2) is approximated as linear, and keyframe
 * `transition` easing is ignored. Values are flat tuples (Color `[r,g,b,a]`, Vector3 `[x,y,z]`).
 */
export function sampleInterpolatedValue(
  keys: readonly GodotKeyframe[],
  time: number,
  interp: number
): number[] {
  if (keys.length === 0) return [];
  const first = keys[0]!;
  if (time <= first.time) return tupleValue(first.value);
  const last = keys[keys.length - 1]!;
  if (time >= last.time) return tupleValue(last.value);

  let lo = first;
  let hi = last;
  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i]!.time <= time && time < keys[i + 1]!.time) {
      lo = keys[i]!;
      hi = keys[i + 1]!;
      break;
    }
  }

  const a = tupleValue(lo.value);
  if (interp === 0) return a; // INTERPOLATION_NEAREST → hold the earlier key
  const b = tupleValue(hi.value);
  const span = hi.time - lo.time;
  const f = span > 0 ? (time - lo.time) / span : 0;
  return a.map((av, i) => av + ((b[i] ?? av) - av) * f);
}

/** A keyframe value as a flat numeric tuple; scalars become 1-tuples. */
function tupleValue(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((n) => (typeof n === 'number' ? n : 0));
  return [typeof value === 'number' ? value : 0];
}

/**
 * The non-transform properties the AnimationPlayer pushes through the
 * AnimatedValue registry (ADR-0016, ADR-0017), mapped to whether they
 * interpolate: `frame` is stepped (a discrete sprite-sheet flipbook), the
 * continuous `modulate`/`size` lerp. A property absent here is not value-pushed.
 */
export const VALUE_PUSH_PROPERTIES: Record<string, boolean> = {
  frame: false,
  modulate: true,
  size: true,
};
