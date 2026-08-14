/**
 * Render-side resolution of an AnimationPlayer's libraries into typed
 * GodotAnimations. THREE-free and React-free by design: it reads only the
 * scene's SubResource `data` strings, so it can later feed a linter rule too.
 *
 * Pipeline: AnimationLibraryRef[] -> AnimationLibrary `_data` map ->
 * Animation SubResources -> Tracks -> Keyframes. Understands `value` tracks
 * (dict-form `{ "times": …, "values": … }` keys) and Godot 4's dedicated 3D
 * transform tracks `position_3d`/`rotation_3d`/`scale_3d` (flat
 * `PackedFloat32Array(time, transition, comps…)` keys); other track types
 * resolve to zero tracks. Skeletal bone sub-paths (`Node:bone`) are skipped
 * pending Skeleton3D bone rendering. Anything unparseable is skipped rather
 * than thrown (lenient-renderer contract).
 */

import type { TscnInternalResource } from '../../../parser/types';
import { parseGodotFloat, parseVector2, parseVector3 } from '../../../parser/vectors';
import { parseColor } from '../../../utils/colorParser';
import { warn } from '../../../logger';
import { NODE_PATH_LITERAL_ANYWHERE_RE, SUB_RESOURCE_REF_BODY, literalText, packedArrayCallAnywhere } from '../../../godot/index.js';
import type { AnimationLibraryRef } from './types';

export type GodotKeyframeValue = number[] | number | boolean;

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
    const libResource = findById(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = asString(libResource.data['_data']);
    if (!dataStr) continue;

    for (const [name, animId] of parseLibraryData(dataStr)) {
      const animResource = findById(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      animations.push(parseAnimation(name, animResource));
    }
  }
  return animations;
}

/**
 * Raw (unresolved) relative NodePath strings on every 'audio' track across the
 * given libraries' Animation resources. Used by the AudioStreamPlayer /
 * AudioStreamPlayer2D / AudioStreamPlayer3D linters: `AnimationMixer` builds
 * its own polyphonic playback bound to an audio track's target node and never
 * reads that node's own `stream` property (animation_mixer.cpp:889-897), so a
 * node driven this way is not silent even with no `stream` of its own.
 *
 * Deliberately separate from `resolveAnimations`/`parseTracks`, which drop
 * 'audio' tracks entirely (THREE's AnimationMixer drives transforms only) —
 * this never touches the render path.
 */
export function resolveAudioTrackPaths(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): string[] {
  const paths: string[] = [];
  for (const lib of libraries) {
    const libResource = findById(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = asString(libResource.data['_data']);
    if (!dataStr) continue;

    for (const [, animId] of parseLibraryData(dataStr)) {
      const animResource = findById(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      paths.push(...audioTrackPaths(animResource.data));
    }
  }
  return paths;
}

/** Every audio track's raw NodePath inner string within one Animation resource's data. */
function audioTrackPaths(data: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (let i = 0; data[`tracks/${i}/type`] !== undefined; i++) {
    const type = literalText(asString(data[`tracks/${i}/type`]) ?? '');
    if (type !== 'audio') continue;
    const inner = extractNodePathInner(asString(data[`tracks/${i}/path`]) ?? '');
    if (inner !== null) paths.push(inner);
  }
  return paths;
}

const SUB_RESOURCE_ENTRY = new RegExp(`"([^"]+)"\\s*:\\s*${SUB_RESOURCE_REF_BODY}`, 'g');

function parseLibraryData(dataStr: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const match of dataStr.matchAll(SUB_RESOURCE_ENTRY)) {
    if (match[1] !== undefined && match[2] !== undefined) entries.push([match[1], match[2]]);
  }
  return entries;
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
    const type = literalText(asString(data[`tracks/${i}/type`]) ?? '');
    const rawPath = asString(data[`tracks/${i}/path`]) ?? '';
    const rawKeys = asString(data[`tracks/${i}/keys`]) ?? '';
    // class_animation.html / animation.h: interp defaults to 1 (LINEAR),
    // update_mode to 0 (CONTINUOUS).
    const interp = numberOr(data[`tracks/${i}/interp`], 1);
    const updateMode = numberOr(data[`tracks/${i}/update`], 0);

    // `hasOwn` so a track type that collides with an Object.prototype key
    // (e.g. "constructor", "toString") doesn't resolve to an inherited member.
    const transform3d = Object.hasOwn(TRANSFORM_3D_TRACKS, type)
      ? TRANSFORM_3D_TRACKS[type]
      : undefined;
    if (transform3d) {
      const inner = extractNodePathInner(rawPath);
      if (inner === null) continue;
      // A `:` segment is a skeleton bone sub-path (e.g. `Skeleton3D:body`);
      // binding those needs Skeleton3D bone rendering, which is deferred — skip
      // so we don't mis-bind the whole transform onto the skeleton node.
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

/** Extract the inner string of a `NodePath("…")` literal, or null if it isn't one. */
export function extractNodePathInner(raw: string): string | null {
  return NODE_PATH_LITERAL_ANYWHERE_RE.exec(raw)?.[1] ?? null;
}

function parseNodePath(raw: string): { targetPath: string; property: string } | null {
  const inner = extractNodePathInner(raw);
  if (inner === null) return null;
  const colon = inner.indexOf(':');
  if (colon === -1) return { targetPath: inner, property: '' };
  return { targetPath: inner.slice(0, colon), property: inner.slice(colon + 1) };
}

const PACKED_FLOAT_RE = new RegExp(`"times"\\s*:\\s*${packedArrayCallAnywhere('PackedFloat32Array').source}`);
const PACKED_TRANSITIONS_RE = new RegExp(`"transitions"\\s*:\\s*${packedArrayCallAnywhere('PackedFloat32Array').source}`);

function parseKeys(keysStr: string): GodotKeyframe[] {
  if (keysStr.length === 0) return [];

  const timesMatch = PACKED_FLOAT_RE.exec(keysStr);
  if (!timesMatch || timesMatch[1] === undefined) return [];
  const times = parseFloatList(timesMatch[1]);
  if (times.length === 0) return [];

  const transMatch = PACKED_TRANSITIONS_RE.exec(keysStr);
  const transitions =
    transMatch && transMatch[1] !== undefined ? parseFloatList(transMatch[1]) : [];

  const values = parseValueArray(keysStr);

  return times.map((time, i) => ({
    time,
    value: values[i] ?? 0,
    transition: transitions[i] ?? 1.0,
  }));
}

const PACKED_FLOAT_ARRAY_RE = packedArrayCallAnywhere('PackedFloat32Array');

/**
 * Decode a 3D transform track's flat key array. Godot serializes these as a
 * single `PackedFloat32Array(time, transition, c0, c1, …, time, transition, …)`
 * with a fixed stride of `2 + components` per keyframe (5 for Vector3
 * position/scale, 6 for the quaternion rotation). Distinct from the `value`
 * track's `{ "times": …, "values": … }` dict form decoded by `parseKeys`.
 */
function parseFlatTransformKeys(keysStr: string, components: number): GodotKeyframe[] {
  const match = PACKED_FLOAT_ARRAY_RE.exec(keysStr);
  if (!match || match[1] === undefined) return [];

  const nums = parseFloatList(match[1]);
  const stride = 2 + components;
  if (nums.length < stride) return [];

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
 * A comma-separated float list, read the way Godot's tokenizer does.
 *
 * `parseFloat` turned the `inf`/`-inf`/`inf_neg`/`nan` that `rtos_fix` writes
 * into a packed float array (variant_parser.cpp:2504) into a silent NaN, and
 * read the trailing garbage in `1abc` as 1. An unreadable element warns and
 * lands as NaN, which is what every downstream comparison already treats as
 * "no keyframe here".
 */
function parseFloatList(raw: string): number[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(',').map((s) => {
    const num = parseGodotFloat(s);
    if (num === null) {
      warn(`[AnimationPlayer] track data element "${s.trim()}" is not a value Godot can read`);
      return NaN;
    }
    return num;
  });
}

/** Extracts and decodes the `"values": [...]` bracketed array (paren-aware). */
function parseValueArray(keysStr: string): GodotKeyframeValue[] {
  const start = keysStr.indexOf('"values":');
  if (start === -1) return [];
  const open = keysStr.indexOf('[', start);
  if (open === -1) return [];

  let depth = 0;
  let end = -1;
  for (let i = open; i < keysStr.length; i++) {
    const ch = keysStr[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];

  return splitTopLevel(keysStr.slice(open + 1, end)).map(decodeValue);
}

/** Splits a comma list while ignoring commas nested in parentheses/brackets. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function decodeValue(raw: string): GodotKeyframeValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('Vector3')) {
    const v = parseVector3(raw);
    return [v.x, v.y, v.z];
  }
  if (raw.startsWith('Vector2')) {
    const v = parseVector2(raw);
    return [v.x, v.y];
  }
  if (raw.startsWith('Color')) {
    const c = parseColor(raw);
    return [c.r, c.g, c.b, c.a];
  }
  return parseFloat(raw);
}

function findById(
  resources: readonly TscnInternalResource[],
  id: string
): TscnInternalResource | undefined {
  return resources.find((r) => {
    const dataId = (r.data as { id?: string }).id;
    return r.id === id || dataId === id;
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

