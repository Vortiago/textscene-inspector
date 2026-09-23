/**
 * SpriteFrames playback: a decoded animation and a playhead to the displayed
 * frame. Frame `i` shows for `durations[i] / speed` seconds (`_get_frame_duration`,
 * `scene/2d/animated_sprite_2d.cpp:542-551`). A stateless lookup: the transport
 * drivers are the only actuators.
 */

import type { SpriteFramesAnimation } from './types';

/**
 * The frame index to display at `elapsed` seconds into an animation. Loops when
 * `loop`, else holds the final frame. Degenerate animations (≤1 frame, fps ≤ 0,
 * or t ≤ 0) stay on frame 0.
 */
export function frameAtTime(animation: SpriteFramesAnimation, elapsed: number): number {
  const n = animation.frames.length;
  if (n <= 1 || animation.fps <= 0 || elapsed <= 0) return 0;

  const total = clipDuration(animation);
  if (!(total > 0)) return 0; // Also catches NaN from a malformed duration.
  const frameTimes = animation.durations.map((d) => d / animation.fps);

  let t = elapsed;
  if (animation.loop) t = elapsed % total;
  else if (elapsed >= total) return n - 1;

  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += frameTimes[i]!;
    if (t < acc) return i;
  }
  return n - 1;
}

/** One loop's total play time in seconds: the sum of per-frame display times. */
export function clipDuration(animation: SpriteFramesAnimation): number {
  if (animation.fps <= 0) return 0;
  return animation.durations.reduce((sum, d) => sum + d, 0) / animation.fps;
}
