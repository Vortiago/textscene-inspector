/**
 * Non-transform value-track support for AnimationPlayer. THREE's AnimationMixer drives transforms
 * only (ADR-0011), so property values like `frame` are sampled here and pushed to the target
 * component through the AnimatedValue registry (ADR-0016).
 */

import type { GodotKeyframe } from './trackParser';

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

/**
 * A `frame` keyframe is an integer. A BOOL key reads as 1 or 0, as `cast_to_blendwise` casts it
 * (`animation.cpp:5731-5733`); a malformed array degrades to 0 rather than poisoning the UV math with NaN.
 */
function numericValue(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return typeof value === 'number' ? value : 0;
}

/**
 * The non-transform properties the AnimationPlayer pushes through the
 * AnimatedValue registry (ADR-0016, ADR-0017), mapped to whether they
 * interpolate: `frame` and `visible` are stepped (a discrete sprite-sheet flipbook, a bool), the
 * continuous `modulate`/`size` lerp. A property absent here is not value-pushed.
 */
export const VALUE_PUSH_PROPERTIES: Record<string, boolean> = {
  frame: false,
  visible: false,
  modulate: true,
  size: true,
};
