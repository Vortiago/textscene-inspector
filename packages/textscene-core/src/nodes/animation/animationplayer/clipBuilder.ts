/**
 * Builds a THREE.AnimationClip from a resolved GodotAnimation.
 *
 * KeyframeTrack names are THREE name-paths (`Target.position`) that
 * THREE.PropertyBinding resolves against the animation root (ADR-0011).
 * Slice-1 supports the transform value tracks only — position, scale,
 * rotation and rotation_degrees — over both 3D (Vector3) and 2D
 * (Vector2 position/scale, scalar rotation) targets. Degrees are converted
 * to radians; everything else is dropped.
 */

import {
  AnimationClip,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  NumberKeyframeTrack,
  VectorKeyframeTrack,
  type AnimationActionLoopStyles,
  type KeyframeTrack,
} from 'three';
import type { GodotAnimation, GodotKeyframe, GodotTrack } from './animationResolver';

const DEG2RAD = Math.PI / 180;

export interface LoopSettings {
  loop: AnimationActionLoopStyles;
  repetitions: number;
  clampWhenFinished: boolean;
}

/**
 * Maps Godot `loop_mode` (0 none, 1 linear, 2 ping-pong) to THREE action loop
 * settings. Ping-pong bounces forward↔backward like Godot's LOOP_PINGPONG.
 */
export function loopSettingsFor(loopMode: number): LoopSettings {
  switch (loopMode) {
    case 2:
      return { loop: LoopPingPong, repetitions: Infinity, clampWhenFinished: false };
    case 1:
      return { loop: LoopRepeat, repetitions: Infinity, clampWhenFinished: false };
    default:
      return { loop: LoopOnce, repetitions: 1, clampWhenFinished: true };
  }
}

export function buildClip(animation: GodotAnimation): AnimationClip {
  const tracks: KeyframeTrack[] = [];
  for (const track of animation.tracks) {
    tracks.push(...buildTracks(track));
  }
  return new AnimationClip(animation.name, animation.length, tracks);
}

function buildTracks(track: GodotTrack): KeyframeTrack[] {
  const times = track.keys.map((k) => k.time);
  const prefix = track.targetPath;

  switch (track.property) {
    case 'position':
    case 'scale':
      return vectorOrComponents(`${prefix}.${track.property}`, times, track.keys, (v) => v);

    case 'rotation':
      return rotationTracks(prefix, times, track.keys, (v) => v);

    case 'rotation_degrees':
      return rotationTracks(prefix, times, track.keys, (v) => v * DEG2RAD);

    default:
      return [];
  }
}

/**
 * Rotation must drive `.rotation[x|y|z]` per component (NumberKeyframeTrack),
 * NOT a VectorKeyframeTrack on `.rotation`: a whole-Euler write bypasses
 * Euler's onChange, leaving `.quaternion` (which builds the matrix) stale, so
 * nothing rotates. Per-component writes go through the Euler setters and sync
 * the quaternion. Per-component lerp also matches Godot and supports a full
 * >180° turn (quaternion slerp would short-circuit it).
 */
function rotationTracks(
  prefix: string,
  times: number[],
  keys: GodotKeyframe[],
  map: (radians: number) => number
): KeyframeTrack[] {
  const first = keys[0]?.value;

  if (typeof first === 'number') {
    // 2D scalar rotation about Z.
    return [new NumberKeyframeTrack(`${prefix}.rotation[z]`, times, keys.map((k) => map(k.value as number)))];
  }

  if (Array.isArray(first) && first.length === 3) {
    return (['x', 'y', 'z'] as const).map(
      (axis, i) =>
        new NumberKeyframeTrack(
          `${prefix}.rotation[${axis}]`,
          times,
          keys.map((k) => map((k.value as number[])[i] ?? 0))
        )
    );
  }

  return [];
}

/**
 * Vector3 keys -> one VectorKeyframeTrack on `vectorName` (`.position`/`.scale`
 * write straight to the matrix, so the whole-vector binding is fine here).
 * Vector2 keys -> per-component NumberKeyframeTracks (`name[x]`, `name[y]`).
 */
function vectorOrComponents(
  vectorName: string,
  times: number[],
  keys: GodotKeyframe[],
  map: (component: number) => number
): KeyframeTrack[] {
  const first = keys[0]?.value;

  if (Array.isArray(first) && first.length === 3) {
    const values = keys.flatMap((k) => (k.value as number[]).map(map));
    return [new VectorKeyframeTrack(vectorName, times, values)];
  }

  if (Array.isArray(first) && first.length === 2) {
    const x = keys.map((k) => map((k.value as number[])[0] ?? 0));
    const y = keys.map((k) => map((k.value as number[])[1] ?? 0));
    return [
      new NumberKeyframeTrack(`${vectorName}[x]`, times, x),
      new NumberKeyframeTrack(`${vectorName}[y]`, times, y),
    ];
  }

  return [];
}
