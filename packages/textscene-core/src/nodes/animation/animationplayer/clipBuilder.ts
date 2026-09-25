/**
 * Builds a THREE.AnimationClip from a resolved GodotAnimation. Track names are THREE name-paths
 * (`Target.position`) that THREE.PropertyBinding resolves against the animation root (ADR-0011).
 * It builds position, scale, rotation and rotation_degrees (as radians) in 3D and 2D, and the
 * `quaternion` of Godot's `rotation_3d` tracks. It drops every other track.
 */

import {
  AnimationClip,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  InterpolateDiscrete,
  InterpolateLinear,
  InterpolateSmooth,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type AnimationActionLoopStyles,
  type InterpolationModes,
  type KeyframeTrack,
} from 'three';
import type { GodotAnimation, GodotKeyframe, GodotTrack } from './animationResolver';
import { warn } from '../../../logger';
import { degToRad } from '../../../godot/math.js';


/** How a track's Godot NodePath binds against the animation root. */
export type TrackBinding =
  // The root itself, bound through an empty node name: `NodePath(".")`, the colon-only
  // `NodePath(":position")` and a path that cancels out (`Sprite/..`).
  | { kind: 'root' }
  // PropertyBinding reads only the final segment and searches the root's whole subtree, so
  // `A/Target` and `B/Target` are the same to it, and a duplicated name binds the first found.
  | { kind: 'name'; name: string }
  // Above the root: PropertyBinding never leaves the root's subtree, and a literal `..` in a
  // track name throws while the action is built. The track is dropped with a warning.
  | { kind: 'unbindable' };

/**
 * Resolves a NodePath the way Godot does, with `..` cancelling the segment before it, and reports
 * how THREE can bind the result. The clip's track names and `resolveTrackTarget` both read it, so
 * the Euler reorder and the base-transform snapshot see every target the mixer drives.
 */
export function resolveTrackBinding(targetPath: string): TrackBinding {
  const stack: string[] = [];
  for (const segment of targetPath.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') {
      stack.push(segment);
      continue;
    }
    // Climbing above the animation root leaves what THREE can address.
    if (stack.length === 0) return { kind: 'unbindable' };
    stack.pop();
  }
  return stack.length === 0 ? { kind: 'root' } : { kind: 'name', name: stack[stack.length - 1]! };
}

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
  if (resolveTrackBinding(track.targetPath).kind === 'unbindable') {
    warn(
      `[AnimationPlayer] track target "${track.targetPath}" resolves above the animation root, ` +
        `which THREE cannot bind — dropping the track so the rest of the clip still plays`
    );
    return [];
  }
  const built = buildTrackData(track);
  const interpolation = threeInterpolation(track);
  for (const t of built) t.setInterpolation(interpolation);
  return built;
}

/**
 * Godot's per-track `interp` to the THREE interpolation constant. NEAREST holds the key at or
 * before the query time (`animation.cpp`), which is `InterpolateDiscrete`. CUBIC is closest to
 * `InterpolateSmooth`, not bit-identical for unevenly spaced keys. The `*_ANGLE` modes add only
 * shortest-path rotation, which THREE's quaternion tracks already take.
 */
function threeInterpolation(track: GodotTrack): InterpolationModes {
  // A VALUE track in UPDATE_DISCRETE mode is nearest whatever `interp` says (same file).
  if (track.type === 'value' && track.updateMode === 1) return InterpolateDiscrete;
  switch (track.interp) {
    case 0:
      return InterpolateDiscrete;
    case 2:
    case 4:
      return InterpolateSmooth;
    default:
      return InterpolateLinear;
  }
}

function buildTrackData(track: GodotTrack): KeyframeTrack[] {
  const times = track.keys.map((k) => k.time);
  // An empty node name binds the mixer root. Every other target binds by its final name,
  // which is all PropertyBinding reads.
  const binding = resolveTrackBinding(track.targetPath);
  const prefix = binding.kind === 'name' ? binding.name : '';

  switch (track.property) {
    case 'position':
      // 2D position is conjugated by diag(1,-1,1), so Y negates (node2dTransform).
      return vectorOrComponents(`${prefix}.position`, times, track.keys, true);

    case 'scale':
      // Scale is not conjugated: node2dGroupProps keeps scale.y as it is.
      return vectorOrComponents(`${prefix}.scale`, times, track.keys, false);

    case 'rotation':
      return rotationTracks(prefix, times, track.keys, (v) => v);

    case 'rotation_degrees':
      return rotationTracks(prefix, times, track.keys, (v) => degToRad(v));

    case 'quaternion':
      return quaternionTracks(prefix, times, track.keys);

    default:
      return [];
  }
}

/**
 * Godot `rotation_3d` keys are quaternions `(x, y, z, w)`, the same component
 * order THREE.Quaternion uses, so they flatten straight into a
 * QuaternionKeyframeTrack on `.quaternion`. 3D transforms are not conjugated, since Godot and
 * THREE are both Y-up and right-handed.
 */
function quaternionTracks(prefix: string, times: number[], keys: GodotKeyframe[]): KeyframeTrack[] {
  const first = keys[0]?.value;
  if (!Array.isArray(first) || first.length !== 4) return [];
  const values = keys.flatMap((k) => k.value as number[]);
  return [new QuaternionKeyframeTrack(`${prefix}.quaternion`, times, values)];
}

/**
 * Per-component `.rotation[x|y|z]` tracks, not a VectorKeyframeTrack on `.rotation`: a whole-Euler
 * write bypasses Euler's onChange and leaves `.quaternion`, which builds the matrix, stale.
 * Per-component lerp also matches Godot and turns more than 180°, which quaternion slerp shortens.
 */
function rotationTracks(
  prefix: string,
  times: number[],
  keys: GodotKeyframe[],
  map: (radians: number) => number
): KeyframeTrack[] {
  const first = keys[0]?.value;

  if (typeof first === 'number') {
    // 2D scalar rotation about Z, negated to match node2dTransform's
    // diag(1,-1,1) conjugation (Godot 2D rotation is clockwise / +Y-down).
    return [new NumberKeyframeTrack(`${prefix}.rotation[z]`, times, keys.map((k) => 0 - map(k.value as number)))];
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
 * Vector3 keys give one VectorKeyframeTrack, since `.position` and `.scale` write straight to the
 * matrix. Vector2 keys give per-component tracks (`name[x]`, `name[y]`). `negateY` applies the
 * diag(1,-1,1) conjugation node2dTransform bakes into the static 2D render, so an animated 2D
 * transform agrees with its authored pose.
 */
function vectorOrComponents(
  vectorName: string,
  times: number[],
  keys: GodotKeyframe[],
  negateY: boolean
): KeyframeTrack[] {
  const first = keys[0]?.value;

  if (Array.isArray(first) && first.length === 3) {
    const values = keys.flatMap((k) => k.value as number[]);
    return [new VectorKeyframeTrack(vectorName, times, values)];
  }

  if (Array.isArray(first) && first.length === 2) {
    const x = keys.map((k) => (k.value as number[])[0] ?? 0);
    const y = keys.map((k) => {
      const yv = (k.value as number[])[1] ?? 0;
      return negateY ? 0 - yv : yv;
    });
    return [
      new NumberKeyframeTrack(`${vectorName}[x]`, times, x),
      new NumberKeyframeTrack(`${vectorName}[y]`, times, y),
    ];
  }

  return [];
}
