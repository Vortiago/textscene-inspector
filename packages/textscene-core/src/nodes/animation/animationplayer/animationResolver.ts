/**
 * Resolves an AnimationPlayer's libraries into typed GodotAnimations, THREE-free and React-free, so a
 * linter rule can use it too. It reads `value` tracks (dict-form keys) and the 3D transform tracks
 * `position_3d`/`rotation_3d`/`scale_3d` (flat keys). Other track types and skeletal bone sub-paths
 * (`Node:bone`) resolve to nothing, and anything unparseable is skipped, not thrown.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { parseValueArray } from './keyframeValues.js';
import type { GodotKeyframeValue } from './keyframeValues.js';
import { parseGodotFloat } from '../../../godot/number.js';
import { boolSlotValue } from '../../../godot/variantBool.js';
import { info, warn } from '../../../logger';
import {
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  dictSubResourceEntries,
  literalText,
  packedArrayCallAnywhere,
} from '../../../godot/index.js';
import { dictCallField, nodePathLiteral } from '../../../godot/variantParser.js';
import { findSubResource } from '../../../resources/SubResourceResolver.js';
import type { AnimationLibraryRef } from './types';

export type { GodotKeyframeValue } from './keyframeValues.js';

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
  keys: GodotKeyframe[];
}

export interface GodotAnimation {
  name: string;
  length: number;
  loopMode: number;
  step: number;
  tracks: GodotTrack[];
}

export function resolveAnimations(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): GodotAnimation[] {
  const animations: GodotAnimation[] = [];
  for (const lib of libraries) {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = asString(libResource.data['_data']);
    if (!dataStr) continue;

    for (const [name, animId] of parseLibraryData(dataStr)) {
      const animResource = findSubResource(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      animations.push(parseAnimation(name, animResource));
    }
  }
  return animations;
}

/**
 * Raw relative NodePath strings on every 'audio' track, for the AudioStreamPlayer linters:
 * `AnimationMixer` plays an audio track through its own playback and never reads the target's
 * `stream` (animation_mixer.cpp:891-898). Separate from `resolveAnimations`, which drops 'audio'
 * tracks, so this never touches the render path.
 */
export function resolveAudioTrackPaths(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): string[] {
  const paths: string[] = [];
  for (const lib of libraries) {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = asString(libResource.data['_data']);
    if (!dataStr) continue;

    for (const [, animId] of parseLibraryData(dataStr)) {
      const animResource = findSubResource(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      paths.push(...audioTrackPaths(animResource.data));
    }
  }
  return paths;
}

/**
 * Whether track `i` takes part in playback. `Track::enabled` defaults to true (animation.h:114),
 * `tracks/N/enabled` sets it (animation.cpp:156-157), and `_update_caches` skips a disabled track
 * of every type (animation_mixer.cpp:689).
 */
function trackEnabled(data: Record<string, unknown>, i: number): boolean {
  return boolSlotValue(asString(data[`tracks/${i}/enabled`])) !== false;
}

/** Every enabled audio track's raw NodePath inner string within one Animation resource's data. */
function audioTrackPaths(data: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (let i = 0; data[`tracks/${i}/type`] !== undefined; i++) {
    if (!trackEnabled(data, i)) continue;
    const type = literalText(asString(data[`tracks/${i}/type`]) ?? '');
    if (type !== 'audio') continue;
    const inner = extractNodePathInner(asString(data[`tracks/${i}/path`]) ?? '');
    if (inner !== null) paths.push(inner);
  }
  return paths;
}

/**
 * Whether any of these libraries holds a clip {@link resolveAnimations} cannot enumerate. A clip in
 * its own `.tres` is an `ExtResource`, which {@link parseLibraryData} does not read, so a caller that
 * treats the resolved set as complete would call a live clip name dangling.
 */
export function hasUnresolvableClips(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): boolean {
  return libraries.some((lib) => {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') return false;
    const dataStr = asString(libResource.data['_data']);
    return dataStr !== undefined && EXT_RESOURCE_CALL_ANYWHERE_RE.test(dataStr);
  });
}

/**
 * `_data`'s `"name": SubResource(…)` clips. An empty name is skipped:
 * `add_animation` refuses it (`animation_library.cpp:35-36,48`,
 * `is_valid_animation_name`: `!(p_name.is_empty() || …)`).
 */
function parseLibraryData(dataStr: string): Array<[string, string]> {
  return dictSubResourceEntries(dataStr)
    .filter(({ key }) => key !== '')
    .map(({ key, id }) => [key, id]);
}

function parseAnimation(name: string, resource: TscnInternalResource): GodotAnimation {
  const data = resource.data;
  return {
    name,
    length: numberOr(data['length'], 1.0),
    loopMode: numberOr(data['loop_mode'], 0),
    step: numberOr(data['step'], 0.1),
    tracks: parseTracks(data),
  };
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

function parseTracks(data: Record<string, unknown>): GodotTrack[] {
  const tracks: GodotTrack[] = [];
  for (let i = 0; data[`tracks/${i}/type`] !== undefined; i++) {
    if (!trackEnabled(data, i)) continue;
    const type = literalText(asString(data[`tracks/${i}/type`]) ?? '');
    const rawPath = asString(data[`tracks/${i}/path`]) ?? '';
    const rawKeys = asString(data[`tracks/${i}/keys`]) ?? '';
    // class_animation.html / animation.h: interp defaults to 1 (LINEAR),
    // update_mode to 0 (CONTINUOUS).
    const interp = numberOr(data[`tracks/${i}/interp`], 1);
    const updateMode = numberOr(data[`tracks/${i}/update`], 0);

    // `hasOwn` so a track type that collides with an Object.prototype key
    // (for example "constructor", "toString") does not resolve to an inherited member.
    const transform3d = Object.hasOwn(TRANSFORM_3D_TRACKS, type)
      ? TRANSFORM_3D_TRACKS[type]
      : undefined;
    if (transform3d) {
      const inner = extractNodePathInner(rawPath);
      if (inner === null) continue;
      // A `:` segment is a skeleton bone sub-path (for example `Skeleton3D:body`). Binding one needs
      // Skeleton3D bone rendering, so skip it rather than bind the whole transform to the skeleton.
      if (inner.includes(':')) continue;

      const keys = parseFlatTransformKeys(rawKeys, transform3d.components);
      if (keys.length === 0) continue;

      tracks.push({ type, targetPath: inner, property: transform3d.property, interp, updateMode, keys });
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
      property: target.property,
      interp,
      updateMode,
      keys,
    });
  }
  return tracks;
}

/** The path a whole NodePath-slot value names ({@link nodePathLiteral}), or null. */
export const extractNodePathInner = nodePathLiteral;

function parseNodePath(raw: string): { targetPath: string; property: string } | null {
  const inner = extractNodePathInner(raw);
  if (inner === null) return null;
  const colon = inner.indexOf(':');
  if (colon === -1) return { targetPath: inner, property: '' };
  return { targetPath: inner.slice(0, colon), property: inner.slice(colon + 1) };
}

// A value track's key Dictionary fields, which `Animation::_set` reads as `Vector<real_t>`
// (animation.cpp:267, :285).
const TIMES_FIELD_RE = dictCallField('times', 'PackedFloat32Array');
const TRANSITIONS_FIELD_RE = dictCallField('transitions', 'PackedFloat32Array');

function parseKeys(keysStr: string): GodotKeyframe[] {
  if (keysStr.length === 0) return [];

  const timesMatch = TIMES_FIELD_RE.exec(keysStr);
  if (!timesMatch || timesMatch[1] === undefined) return [];
  const times = parseFloatList(timesMatch[1]);
  if (times === null || times.length === 0) return [];

  const transMatch = TRANSITIONS_FIELD_RE.exec(keysStr);
  const transitions =
    transMatch && transMatch[1] !== undefined ? parseFloatList(transMatch[1]) : [];
  if (transitions === null) return [];

  const values = parseValueArray(keysStr);
  if (values === null) return [];

  // Paired by index, so a short list has no value at that time. A keyframe at zero would pin a
  // scalar property there, and hand `clipBuilder` a mixed-shape vector list whose flattened length
  // is not a multiple of `times`, so every sample would be NaN.
  if (values.length !== times.length) {
    info(
      `[AnimationPlayer] ${values.length} keyframe values for ${times.length} times — dropping the track`
    );
    return [];
  }

  return times.map((time, i) => ({
    time,
    value: values[i]!,
    transition: transitions[i] ?? 1.0,
  }));
}

const PACKED_FLOAT_ARRAY_RE = packedArrayCallAnywhere('PackedFloat32Array');

/**
 * Decode a 3D transform track's flat key array, `PackedFloat32Array(time, transition, c0, c1, …)`,
 * with a stride of `2 + components` per keyframe (5 for position/scale, 6 for the rotation
 * quaternion). `parseKeys` decodes the `value` track's `{ "times": …, "values": … }` dict form.
 */
function parseFlatTransformKeys(keysStr: string, components: number): GodotKeyframe[] {
  const match = PACKED_FLOAT_ARRAY_RE.exec(keysStr);
  if (!match || match[1] === undefined) return [];

  const nums = parseFloatList(match[1]);
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = parseGodotFloat(value);
  // `??` catches only null. `inf` and `nan` are legal TSCN floats that `parseGodotFloat` returns as
  // Infinity/NaN, and as a clip duration or blend weight they give an infinite clip or a weight that
  // fails every `> EPSILON` test. A value the renderer cannot use falls back to the documented default.
  return parsed === null || !Number.isFinite(parsed) ? fallback : parsed;
}

