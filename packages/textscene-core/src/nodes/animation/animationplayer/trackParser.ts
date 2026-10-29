/**
 * Reads the tracks of one Animation resource into typed GodotTracks, THREE-free and React-free: the
 * `value` tracks (dict-form keys) and the 3D transform tracks `position_3d`/`rotation_3d`/`scale_3d`
 * (flat keys). Other track types resolve to nothing, and anything unparseable is skipped, not thrown.
 */

import type { GodotKeyframeValue } from './keyframeValues.js';
import { parseValueArray } from './keyframeValues.js';
import { parseGodotFloat } from '../../../godot/variant/number.js';
import { boolSlotValue, scalarSlotValue } from '../../../godot/variant/variantBool.js';
import { info, warn } from '../../../logger';
import { literalText } from '../../../godot/string/string.js';
import {
  packedArrayCallAnywhere,
  dictCallField,
  nodePathLiteral,
} from '../../../godot/variant/variantParser.js';

export interface GodotKeyframe {
  time: number;
  value: GodotKeyframeValue;
  transition: number;
}

export interface GodotTrack {
  /** `'value'` or a 3D transform track type (`position_3d`/`rotation_3d`/`scale_3d`). */
  type: string;
  /** Node portion of the track's NodePath, relative to the animation root. */
  targetPath: string;
  /**
   * The subnames of a 3D transform track path (`Skeleton3D:b4` has `['b4']`), else empty. With one
   * subname on a Skeleton3D the mixer binds a bone, and any other track is a transform track of the
   * node (`animation_mixer.cpp:791-803`).
   */
  subnames: string[];
  /**
   * The animated transform property. For `value` tracks this is the NodePath's
   * property part (`position`, `rotation`, …). For 3D transform tracks it is
   * derived from the track type: `position`, `scale`, or `quaternion`.
   */
  property: string;
  /**
   * Godot interpolation mode: NEAREST 0, LINEAR 1 (the default when the key is
   * absent), CUBIC 2, LINEAR_ANGLE 3, CUBIC_ANGLE 4.
   */
  interp: number;
  /**
   * VALUE-track update mode: CONTINUOUS 0, DISCRETE 1, CAPTURE 2. DISCRETE
   * FORCES nearest interpolation regardless of `interp` (`animation.cpp`).
   */
  updateMode?: number;
  /** `Track::loop_wrap` (`animation.h:110`): whether the span past the last key runs on to the first. */
  loopWrap: boolean;
  keys: GodotKeyframe[];
}

/**
 * Whether track `i` takes part in playback. `Track::enabled` defaults to true (animation.h:114),
 * `tracks/N/enabled` sets it (animation.cpp:156-157), and `_update_caches` skips a disabled track
 * of every type (animation_mixer.cpp:689).
 */
export function trackEnabled(data: Readonly<Record<string, string>>, i: number): boolean {
  return boolSlotValue(data[`tracks/${i}/enabled`]) !== false;
}

/** `Track::loop_wrap`, true unless `tracks/N/loop_wrap` says otherwise (animation.cpp:152-153). */
function trackLoopWraps(data: Readonly<Record<string, string>>, i: number): boolean {
  return boolSlotValue(data[`tracks/${i}/loop_wrap`]) !== false;
}

/**
 * Godot 4's dedicated 3D transform track types and how they map onto a THREE
 * transform: the animated property is implied by the type (not a NodePath
 * suffix), and keys are a flat `PackedFloat32Array(time, transition, comps…)`.
 * `rotation_3d` is a quaternion (4 comps); position/scale are Vector3 (3 comps).
 */
const TRANSFORM_3D_TRACKS: Record<string, { property: string; components: number }> = {
  position_3d: { property: 'position', components: 3 },
  scale_3d: { property: 'scale', components: 3 },
  rotation_3d: { property: 'quaternion', components: 4 },
};

export function parseTracks(data: Readonly<Record<string, string>>): GodotTrack[] {
  const tracks: GodotTrack[] = [];
  for (let i = 0; data[`tracks/${i}/type`] !== undefined; i++) {
    if (!trackEnabled(data, i)) continue;
    const type = literalText(data[`tracks/${i}/type`] ?? '');
    const rawPath = data[`tracks/${i}/path`] ?? '';
    const rawKeys = data[`tracks/${i}/keys`] ?? '';
    // class_animation.html / animation.h: interp defaults to 1 (LINEAR),
    // update_mode to 0 (CONTINUOUS).
    const interp = numberOr(data[`tracks/${i}/interp`], 1);
    const updateMode = numberOr(data[`tracks/${i}/update`], 0);
    const loopWrap = trackLoopWraps(data, i);

    // `hasOwn` so a track type that collides with an Object.prototype key
    // (for example "constructor", "toString") does not resolve to an inherited member.
    const transform3d = Object.hasOwn(TRANSFORM_3D_TRACKS, type) ? TRANSFORM_3D_TRACKS[type] : undefined;
    if (transform3d) {
      const inner = extractNodePathInner(rawPath);
      if (inner === null) continue;
      const target = parseTransformNodePath(inner);

      const keys = parseFlatTransformKeys(rawKeys, transform3d.components);
      if (keys.length === 0) continue;

      tracks.push({
        type,
        ...target,
        property: transform3d.property,
        interp,
        updateMode,
        loopWrap,
        keys,
      });
      continue;
    }

    if (type !== 'value') continue;

    const target = parseNodePath(rawPath);
    if (!target || target.property.length === 0) continue;

    const keys = parseKeys(rawKeys);
    if (keys.length === 0) continue;

    tracks.push({
      type,
      targetPath: target.targetPath,
      subnames: [],
      property: target.property,
      interp,
      updateMode,
      loopWrap,
      keys,
    });
  }
  return tracks;
}

/** The path a whole NodePath-slot value names ({@link nodePathLiteral}), or null. */
export const extractNodePathInner = nodePathLiteral;

/** The node and the subnames of a transform track's path: `Skeleton3D:b4` is `Skeleton3D` and `['b4']`. */
function parseTransformNodePath(inner: string): { targetPath: string; subnames: string[] } {
  const colon = inner.indexOf(':');
  if (colon === -1) return { targetPath: inner, subnames: [] };
  const subnames = inner.slice(colon + 1).split(':');
  return { targetPath: inner.slice(0, colon), subnames: subnames.filter((subname) => subname !== '') };
}

function parseNodePath(raw: string): { targetPath: string; property: string } | null {
  const inner = extractNodePathInner(raw);
  if (inner === null) return null;
  const colon = inner.indexOf(':');
  if (colon === -1) return { targetPath: inner, property: '' };
  return { targetPath: inner.slice(0, colon), property: inner.slice(colon + 1) };
}

// A value track's key Dictionary fields, which `Animation::_set` reads as `Vector<real_t>`
// (animation.cpp:267, :285).
const readTimesField = dictCallField('times', 'PackedFloat32Array');
const readTransitionsField = dictCallField('transitions', 'PackedFloat32Array');

function parseKeys(keysStr: string): GodotKeyframe[] {
  if (keysStr.length === 0) return [];

  const timesBody = readTimesField(keysStr);
  if (timesBody === null) return [];
  const times = parseFloatList(timesBody);
  if (times === null || times.length === 0) return [];

  const transitionsBody = readTransitionsField(keysStr);
  const transitions = transitionsBody === null ? [] : parseFloatList(transitionsBody);
  if (transitions === null) return [];

  const values = parseValueArray(keysStr);
  if (values === null) return [];

  // Paired by index, so a short list has no value at that time. A keyframe at zero would pin a
  // scalar property there, and hand `clipBuilder` a mixed-shape vector list whose flattened length
  // is not a multiple of `times`, so every sample would be NaN.
  if (values.length !== times.length) {
    info(`[AnimationPlayer] ${values.length} keyframe values for ${times.length} times — dropping the track`);
    return [];
  }

  return times.map((time, i) => ({
    time,
    value: values[i]!,
    transition: transitions[i] ?? 1.0,
  }));
}

const PACKED_FLOAT32_CALLS = packedArrayCallAnywhere('PackedFloat32Array');

/**
 * Decode a 3D transform track's flat key array, `PackedFloat32Array(time, transition, c0, c1, …)`,
 * with a stride of `2 + components` per keyframe (5 for position/scale, 6 for the rotation
 * quaternion). `parseKeys` decodes the `value` track's `{ "times": …, "values": … }` dict form.
 */
function parseFlatTransformKeys(keysStr: string, components: number): GodotKeyframe[] {
  const body = PACKED_FLOAT32_CALLS.first(keysStr);
  if (body === null) return [];

  const nums = parseFloatList(body);
  if (nums === null) return [];
  const stride = 2 + components;
  // Arity is all-or-nothing, as in the engine: `Animation::_set` opens each flat-track branch with
  // `ERR_FAIL_COND_V(vcount % *_TRACK_SIZE, false)` (`animation.cpp:163` position, `:185` rotation,
  // `:208` scale, `:230` blend shape) before the `resize` at `:167`, so a ragged array leaves no keys.
  if (nums.length === 0 || nums.length % stride !== 0) return [];

  const keys: GodotKeyframe[] = [];
  for (let i = 0; i + stride <= nums.length; i += stride) {
    keys.push({
      time: nums[i]!,
      transition: nums[i + 1]!,
      value: nums.slice(i + 2, i + 2 + components),
    });
  }
  return keys;
}

/**
 * A comma-separated float list read as Godot's tokenizer reads it (`1abc` is refused), or `null`, as
 * in {@link decodeValue}, when an element is not one this renderer can key. `inf`/`nan` spellings
 * `rtos_fix` writes (variant_parser.cpp:2504) and `1e999` are non-finite, and a non-finite time
 * poisons every later sample since three.js divides by the span, so the result is tested.
 */
function parseFloatList(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  const values: number[] = [];
  for (const part of trimmed.split(',')) {
    const num = parseGodotFloat(part);
    if (num === null || !Number.isFinite(num)) {
      warn(
        `[AnimationPlayer] track data element "${part.trim()}" is not a value this renderer can key — dropping the track`
      );
      return null;
    }
    values.push(num);
  }
  return values;
}

export function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = scalarSlotValue(value);
  // `??` catches only null. `inf` and `nan` are legal TSCN floats that `scalarSlotValue` returns as
  // Infinity/NaN, and as a clip duration or blend weight they give an infinite clip or a weight that
  // fails every `> EPSILON` test. A value the renderer cannot use falls back to the documented default.
  return parsed === null || !Number.isFinite(parsed) ? fallback : parsed;
}
