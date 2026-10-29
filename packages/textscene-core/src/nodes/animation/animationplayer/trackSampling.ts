/**
 * What the bone tracks and the value tracks of a clip share to read a track through
 * `animationTrackSampler.ts`: the setup of a track and its keys as the `real_t` values `Animation` holds.
 */

import { storedReal } from '../../../godot/math/real.js';
import type { SampleSetup, TrackKey } from '../../../godot/scene/animationTrackSampler.js';
import type { GodotAnimation } from './animationResolver';
import type { GodotKeyframe, GodotTrack } from './trackParser';

/** `TrackUpdateMode.DISCRETE`: the key holds until the next one, whatever `interp` says (`animation.cpp`). */
const UPDATE_DISCRETE = 1;

export function sampleSetupOf(
  track: GodotTrack,
  animation: Pick<GodotAnimation, 'length' | 'loopMode'>
): SampleSetup {
  return {
    interp: track.updateMode === UPDATE_DISCRETE ? 0 : track.interp,
    loopWrap: track.loopWrap,
    length: storedReal(animation.length),
    loopMode: animation.loopMode,
  };
}

/** A key with its value read by `read`, as `real_t` times. */
export function trackKeyOf<T>(key: GodotKeyframe, read: (value: unknown) => T): TrackKey<T> {
  return { time: storedReal(key.time), transition: storedReal(key.transition), value: read(key.value) };
}

/**
 * The components of a key value as a flat tuple, each a `real_t`. A boolean reads as 1 or 0, as
 * `cast_to_blendwise` casts it (`animation.cpp:5731-5733`), and anything else that is not a number
 * as 0, so a malformed key cannot poison the maths with NaN.
 */
export function componentsOf(value: unknown): number[] {
  return (Array.isArray(value) ? (value as unknown[]) : [value]).map((component) => {
    if (typeof component === 'boolean') return component ? 1 : 0;
    return storedReal(typeof component === 'number' ? component : 0);
  });
}
