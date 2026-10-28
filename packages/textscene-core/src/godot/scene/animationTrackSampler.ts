/**
 * The value of a position, rotation or scale track of an Animation at a time: `Animation::_interpolate`
 * (`scene/resources/animation.cpp:2524-2726`) for a playhead that moves forward, which is how the
 * mixer samples a track it applies (`animation_mixer.cpp:1373-1380`). Key times, transitions and
 * values are `real_t`, so a caller rounds them to float32 first.
 */

import { clamp, ease, isEqualApprox, isZeroApprox, pingpongf, posmod, round } from '../math/math.js';
import { storedReal as f } from '../math/real.js';
import {
  quaternionSlerp,
  quaternionSphericalCubicInterpolateInTime,
  type Quaternion,
} from '../math/quaternion.js';
import { vector3CubicInterpolateInTime, vector3Lerp, type KeyTimes, type Vector3 } from '../math/vector.js';
import { AnimationInterpolation, AnimationLoopMode } from './animation.js';

/** One key of a track: `Animation::TKey` (`animation.h:102-108`). */
export interface TrackKey<T> {
  time: number;
  /** The easing of the span that starts at this key: 0 holds the key, 1 is linear, other values bend `c`. */
  transition: number;
  value: T;
}

/** What a track and its Animation say about how to read the keys. */
export interface SampleSetup {
  /** `Animation::InterpolationType`: the track's `interp`. */
  interp: number;
  /** `Track::loop_wrap` (`tracks/N/loop_wrap`): whether the span from the last key to the first wraps. */
  loopWrap: boolean;
  /** `Animation::length`. A key past it is not read. */
  length: number;
  /** `Animation::LoopMode`. */
  loopMode: number;
}

/** How a kind of value moves between keys. */
interface ValueBlend<T> {
  lerp: (from: T, to: T, weight: number) => T;
  cubic: (from: T, to: T, pre: T, post: T, weight: number, times: KeyTimes) => T;
}

const VECTOR3_BLEND: ValueBlend<Vector3> = { lerp: vector3Lerp, cubic: vector3CubicInterpolateInTime };

const QUATERNION_BLEND: ValueBlend<Quaternion> = {
  lerp: quaternionSlerp,
  cubic: quaternionSphericalCubicInterpolateInTime,
};

/** The value of a position or scale track at `time`, or null where `Animation` has none to give. */
export function sampleVector3Track(
  keys: readonly TrackKey<Vector3>[],
  time: number,
  setup: SampleSetup
): Vector3 | null {
  return sampleTrack(keys, time, setup, VECTOR3_BLEND);
}

/** The value of a rotation track at `time`, or null where `Animation` has none to give. */
export function sampleQuaternionTrack(
  keys: readonly TrackKey<Quaternion>[],
  time: number,
  setup: SampleSetup
): Quaternion | null {
  return sampleTrack(keys, time, setup, QUATERNION_BLEND);
}

/** The keys a span reads: `idx` to `next`, with `pre` and `post` around them for a cubic. */
interface Span {
  idx: number;
  next: number;
  pre: number;
  post: number;
  /** The time the playhead is past `idx`, and the time from `idx` to `next`: both 0 on an edge that holds. */
  from: number;
  delta: number;
}

function sampleTrack<T>(
  keys: readonly TrackKey<T>[],
  time: number,
  setup: SampleSetup,
  blend: ValueBlend<T>
): T | null {
  // The last key within the length counts, and keys past it do not (`:2525`).
  const count = findKey(keys, setup.length) + 1;
  if (count <= 0) return null;
  if (count === 1) return keys[0]!.value;

  const span = spanAt(keys, count, time, setup);
  const { idx, next } = span;
  const c = isZeroApprox(span.delta) ? 0 : f(span.from / span.delta);

  const key = keys[idx]!;
  if (key.transition === 0) return key.value;
  const eased = key.transition === 1 ? c : f(ease(c, key.transition));

  switch (setup.interp) {
    case AnimationInterpolation.LINEAR:
    case AnimationInterpolation.LINEAR_ANGLE:
      return blend.lerp(key.value, keys[next]!.value, eased);
    case AnimationInterpolation.CUBIC:
    case AnimationInterpolation.CUBIC_ANGLE:
      return blend.cubic(
        key.value,
        keys[next]!.value,
        keys[span.pre]!.value,
        keys[span.post]!.value,
        eased,
        cubicTimes(keys, span, setup)
      );
    default:
      return key.value;
  }
}

/**
 * `Animation::_find` (`animation.cpp:2404-2454`) without a limit: the index of the last key at or
 * before `time`, -1 before the first, and -2 for no key.
 */
function findKey<T>(keys: readonly TrackKey<T>[], time: number): number {
  if (keys.length === 0) return -2;
  let low = 0;
  let high = keys.length - 1;
  let middle = 0;
  while (low <= high) {
    middle = Math.trunc((low + high) / 2);
    const keyTime = keys[middle]!.time;
    if (isEqualApprox(time, keyTime)) return middle;
    if (time < keyTime) high = middle - 1;
    else low = middle + 1;
  }
  return keys[middle]!.time > time ? middle - 1 : middle;
}

/** Whether the span past the last key runs on to the first: the track wraps and the Animation loops. */
function wrapsAround({ loopWrap, loopMode }: SampleSetup): boolean {
  return loopWrap && loopMode !== AnimationLoopMode.NONE;
}

function spanAt<T>(keys: readonly TrackKey<T>[], count: number, time: number, setup: SampleSetup): Span {
  const found = findKey(keys, time);
  const isStartEdge = found === -1;
  const isEndEdge = found >= count - 1;
  const needsCubic =
    setup.interp === AnimationInterpolation.CUBIC || setup.interp === AnimationInterpolation.CUBIC_ANGLE;

  let span: Span;
  if (!wrapsAround(setup)) span = spanWithoutLoop(found, isStartEdge, count, needsCubic);
  else if (setup.loopMode === AnimationLoopMode.LINEAR) {
    span = spanAroundLoop(keys, found, isStartEdge, isEndEdge, count, time, setup, needsCubic);
  } else span = spanAcrossPingPong(keys, found, isStartEdge, isEndEdge, count, time, setup, needsCubic);

  if (!isStartEdge && !isEndEdge) {
    const start = keys[span.idx]!.time;
    return { ...span, delta: f(keys[span.next]!.time - start), from: f(time - start) };
  }
  return span;
}

/** `LOOP_NONE`, or a track that does not wrap: both ends hold their key (`:2559-2566`). */
function spanWithoutLoop(found: number, isStartEdge: boolean, count: number, needsCubic: boolean): Span {
  const idx = isStartEdge ? 0 : found;
  const last = count - 1;
  return {
    idx,
    next: clamp(idx + 1, 0, last),
    pre: needsCubic ? clamp(idx - 1, 0, last) : -1,
    post: needsCubic ? clamp(idx + 2, 0, last) : -1,
    from: 0,
    delta: 0,
  };
}

/** `LOOP_LINEAR`: the span past the last key runs to the first, and the first key's span starts at the last (`:2567-2594`). */
function spanAroundLoop<T>(
  keys: readonly TrackKey<T>[],
  found: number,
  isStartEdge: boolean,
  isEndEdge: boolean,
  count: number,
  time: number,
  setup: SampleSetup,
  needsCubic: boolean
): Span {
  const idx = isStartEdge ? count - 1 : found;
  const next = posmod(idx + 1, count);
  const span: Span = {
    idx,
    next,
    pre: needsCubic ? posmod(idx - 1, count) : -1,
    post: needsCubic ? posmod(idx + 2, count) : -1,
    from: 0,
    delta: 0,
  };
  const idxTime = keys[idx]!.time;
  const nextTime = keys[next]!.time;
  if (isStartEdge) {
    const endTime = Math.max(f(setup.length - idxTime), 0);
    return { ...span, delta: f(endTime + nextTime), from: f(endTime + time) };
  }
  if (isEndEdge) {
    return { ...span, delta: f(f(setup.length - idxTime) + nextTime), from: f(time - idxTime) };
  }
  return span;
}

/** `LOOP_PINGPONG`: the keys fold back at both ends (`:2595-2625`). */
function spanAcrossPingPong<T>(
  keys: readonly TrackKey<T>[],
  found: number,
  isStartEdge: boolean,
  isEndEdge: boolean,
  count: number,
  time: number,
  setup: SampleSetup,
  needsCubic: boolean
): Span {
  const foldedIndex = (index: number) => round(pingpongf(f(index + 0.5), count) - 0.5);
  const walked = isStartEdge ? -1 : found;
  const idx = foldedIndex(walked);
  const next = foldedIndex(walked + 1);
  const span: Span = {
    idx,
    next,
    pre: needsCubic ? foldedIndex(walked - 1) : -1,
    post: needsCubic ? foldedIndex(walked + 2) : -1,
    from: 0,
    delta: 0,
  };
  const idxTime = keys[idx]!.time;
  const nextTime = keys[next]!.time;
  if (isStartEdge) {
    const endTime = Math.max(idxTime, 0);
    return { ...span, delta: f(endTime + nextTime), from: f(endTime + time) };
  }
  if (isEndEdge) {
    return { ...span, delta: f(f(f(setup.length * 2) - idxTime) - nextTime), from: f(time - idxTime) };
  }
  return span;
}

/** The times of `next`, `pre` and `post` counted from `idx`, wrapped as the loop mode wraps them (`:2693-2714`). */
function cubicTimes<T>(
  keys: readonly TrackKey<T>[],
  { idx, next, pre, post }: Span,
  setup: SampleSetup
): KeyTimes {
  const timeOf = (index: number) => keys[index]!.time;
  const start = timeOf(idx);
  if (!wrapsAround(setup)) {
    return { preT: f(timeOf(pre) - start), toT: f(timeOf(next) - start), postT: f(timeOf(post) - start) };
  }
  const { length } = setup;
  if (setup.loopMode === AnimationLoopMode.LINEAR) {
    return {
      preT: pre > idx ? f(f(-length + timeOf(pre)) - start) : f(timeOf(pre) - start),
      toT: next < idx ? f(f(length + timeOf(next)) - start) : f(timeOf(next) - start),
      postT: next < idx || post <= idx ? f(f(length + timeOf(post)) - start) : f(timeOf(post) - start),
    };
  }
  return pingPongCubicTimes(keys, { idx, next, pre, post }, length);
}

/** The times of the cubic where the keys fold back, which reflect the span across the end that holds the playhead. */
function pingPongCubicTimes<T>(
  keys: readonly TrackKey<T>[],
  { idx, next, pre, post }: Pick<Span, 'idx' | 'next' | 'pre' | 'post'>,
  length: number
): KeyTimes {
  const timeOf = (index: number) => keys[index]!.time;
  const start = timeOf(idx);
  let preT = f(timeOf(pre) - start);
  let toT = f(timeOf(next) - start);
  let postT = f(timeOf(post) - start);

  if ((pre > idx && idx === next && post < next) || (pre < idx && idx === next && post > next)) {
    preT = f(start - timeOf(pre));
  } else if (pre === idx) {
    preT = idx < next ? f(f(-start) * 2) : f(f(length - start) * 2);
  }

  if (idx === next) {
    toT = pre < idx ? f(f(length - start) * 2) : f(f(-start) * 2);
    postT = f(f(timeOf(next) - timeOf(post)) + toT);
  } else if (next === post) {
    postT = idx < next ? f(f(f(length - timeOf(next)) * 2) + toT) : f(f(f(-timeOf(next)) * 2) + toT);
  }
  return { preT, toT, postT };
}
