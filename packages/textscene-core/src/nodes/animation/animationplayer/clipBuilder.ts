/**
 * Builds a THREE.AnimationClip from a resolved GodotAnimation.
 *
 * KeyframeTrack names are THREE name-paths (`Target.position`) that
 * THREE.PropertyBinding resolves against the animation root (ADR-0011).
 * Supports the transform tracks — position, scale, rotation and
 * rotation_degrees — over both 3D (Vector3) and 2D (Vector2 position/scale,
 * scalar rotation) targets, plus the `quaternion` property emitted by Godot's
 * dedicated `rotation_3d` tracks (driven through a QuaternionKeyframeTrack).
 * Degrees are converted to radians; everything else is dropped.
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


/**
 * How a track's Godot NodePath binds against the animation root.
 *
 * `root` — the path resolves to the animation root itself. THREE binds that
 * through an EMPTY node name, so `NodePath(".")` and the colon-only
 * `NodePath(":position")` form both land here, as does anything that cancels
 * out (`Sprite/..`).
 *
 * `name` — bind by this name. THREE.PropertyBinding reads only the final
 * segment and searches the root's whole subtree, so the ancestors buy nothing;
 * `A/Target` and `B/Target` are indistinguishable to it, and a duplicated name
 * binds to whichever it finds first (#371 proposes exact binding instead).
 *
 * `unbindable` — the path climbs above the animation root, which
 * PropertyBinding cannot reach: its search never leaves the root's subtree, and
 * a literal `..` in a track name is outside its grammar and throws while the
 * action is built. Such a track is dropped with a warning. NOT supported, and
 * #371 is what would actually support it.
 */
export type TrackBinding =
  | { kind: 'root' }
  | { kind: 'name'; name: string }
  | { kind: 'unbindable' };

/**
 * Resolve a NodePath the way Godot does — `..` cancels the segment before it —
 * and report how THREE can bind the result.
 *
 * The single source of truth for both the clip's track names and
 * `resolveTrackTarget`. Two functions computing this separately is how the
 * Euler reorder and the base-transform snapshot come to miss a target the mixer
 * is driving.
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
 * Godot's per-track `interp` → the THREE interpolation constant.
 *
 * NEAREST is a step/hold, not a round-to-nearest: `animation.cpp` returns
 * `p_keys[idx].value` for the key at-or-before the query time, which is exactly
 * `InterpolateDiscrete`. CUBIC is a time-aware Catmull-Rom, closest to
 * `InterpolateSmooth` (not bit-identical for unevenly-spaced keys). The
 * `*_ANGLE` variants only add shortest-path rotation, which THREE's quaternion
 * tracks already take, so they reduce to their base mode.
 *
 * A VALUE track in UPDATE_DISCRETE mode is FORCED to nearest whatever `interp`
 * says — same file.
 */
function threeInterpolation(track: GodotTrack): InterpolationModes {
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
  // A track targeting the animation root itself binds through an empty node
  // name — THREE.PropertyBinding resolves that to the mixer root. Every other
  // target binds by its final name, which is all PropertyBinding reads.
  const binding = resolveTrackBinding(track.targetPath);
  const prefix = binding.kind === 'name' ? binding.name : '';

  switch (track.property) {
    case 'position':
      // 2D position is conjugated by diag(1,-1,1) — negate Y (node2dTransform).
      return vectorOrComponents(`${prefix}.position`, times, track.keys, true);

    case 'scale':
      // Scale is NOT conjugated (node2dGroupProps keeps scale.y as-is).
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
 * QuaternionKeyframeTrack on `.quaternion` (THREE slerps between them). 3D
 * transforms aren't conjugated (Godot and THREE are both Y-up right-handed).
 */
function quaternionTracks(prefix: string, times: number[], keys: GodotKeyframe[]): KeyframeTrack[] {
  const first = keys[0]?.value;
  if (!Array.isArray(first) || first.length !== 4) return [];
  const values = keys.flatMap((k) => k.value as number[]);
  return [new QuaternionKeyframeTrack(`${prefix}.quaternion`, times, values)];
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
 * Vector3 keys -> one VectorKeyframeTrack on `vectorName` (3D transforms aren't
 * conjugated; `.position`/`.scale` write straight to the matrix, so the
 * whole-vector binding is fine here).
 * Vector2 keys -> per-component NumberKeyframeTracks (`name[x]`, `name[y]`).
 * `negateY` applies the diag(1,-1,1) conjugation that node2dTransform bakes into
 * the static 2D render (position negates Y, scale does not), so an animated 2D
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
