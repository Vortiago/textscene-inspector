/**
 * The `"values": [...]` half of a value track's key dict.
 *
 * A sibling of `animationResolver.ts`: this is the Variant grammar one keyframe
 * is written in, not how a track or a library is assembled. The whole module is
 * one question — can this renderer key this text — and `null` is its answer for
 * no.
 *
 * Pure `.ts`, no THREE.
 */

import { variantTupleRegex, parseGodotFloat, allFinite } from '../../../godot/number.js';
import { storedInt } from '../../../godot/int.js';
import { info } from '../../../logger';

/** One keyframe's decoded value: a composite's components, a scalar, or a flag. */
export type GodotKeyframeValue = number[] | number | boolean;

/**
 * The decoded `"values": [...]` array (paren-aware), or `null` when the array is
 * absent, unterminated, or holds a key that is not a value this renderer can
 * key — each of which drops the whole track, since there is nothing to
 * interpolate through at that key's time. `[]` therefore means the one thing it
 * can legitimately mean: a `"values": []` that is genuinely empty.
 *
 * `info` rather than `warn`: the common causes — an unmodelled Variant
 * (`Transform3D`, a dict) and a non-finite component — are both legal in a
 * sound scene, so only the preview is short a track. Text Godot's own tokenizer
 * cannot read lands here too; `parseFloatList` below reports that class at
 * `warn` where it appears in a packed array.
 */
export function parseValueArray(keysStr: string): GodotKeyframeValue[] | null {
  const start = keysStr.indexOf('"values":');
  if (start === -1) return null;
  const open = keysStr.indexOf('[', start);
  if (open === -1) return null;

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
  if (end === -1) return null;

  const values: GodotKeyframeValue[] = [];
  for (const part of splitKeyframeParts(keysStr.slice(open + 1, end))) {
    const value = decodeValue(part);
    if (value === null) {
      info(`[AnimationPlayer] keyframe value "${part}" is not one this renderer can key — dropping the track`);
      return null;
    }
    values.push(value);
  }
  return values;
}

/** Splits a comma list while ignoring commas nested in parentheses/brackets. */
function splitKeyframeParts(body: string): string[] {
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

// NaN, not 0: a component the reader refuses has no value, and `0` is a legal
// finite one that `allFinite` waves through — `Vector3i(99999999999999999999,
// 0, 0)` then keys the node at the origin. NaN takes `decodeValue`'s null exit.
const keyInt = (text: string | undefined): number => storedInt(text) ?? NaN;
const keyFloat = (text: string | undefined): number => parseGodotFloat(text ?? '') ?? NaN;

/**
 * The composite literals a keyframe can hold, each matched WHOLE.
 *
 * A prefix test cannot tell these apart: `'Vector2i(…)'.startsWith('Vector2')`
 * is true, so an integer literal reached `parseVector2`, missed its float
 * grammar and THREW — discarding the whole scene rather than one keyframe. A
 * keyframe stores an arbitrary Variant and plenty of animated properties are
 * declared with an `i`-suffixed one: `SubViewport.size` is `Variant::VECTOR2I`
 * (viewport.cpp:5579).
 *
 * `exact` on every entry: a keyframe is a Variant stored as the type the file
 * spells, not a value written into a typed slot, so `can_convert_strict` does
 * not apply. Without it the widened `Vector3i` arm matched a `Vector3` rotation
 * key and truncated it to whole degrees.
 *
 * Anchored regexes rather than prefixes, so no two entries can match the same
 * text and order carries no meaning.
 */
const COMPOSITE_KEYS: ReadonlyArray<{
  re: RegExp;
  read: (m: RegExpExecArray) => number[];
}> = [
  { re: variantTupleRegex('Vector2i', 2), read: (m) => [keyInt(m[1]), keyInt(m[2])] },
  {
    re: variantTupleRegex('Vector3i', 3),
    read: (m) => [keyInt(m[1]), keyInt(m[2]), keyInt(m[3])],
  },
  { re: variantTupleRegex('Vector2', 2), read: (m) => [keyFloat(m[1]), keyFloat(m[2])] },
  {
    re: variantTupleRegex('Vector3', 3),
    read: (m) => [keyFloat(m[1]), keyFloat(m[2]), keyFloat(m[3])],
  },
  {
    re: variantTupleRegex('Color', 4),
    read: (m) => [keyFloat(m[1]), keyFloat(m[2]), keyFloat(m[3]), keyFloat(m[4])],
  },
];

/**
 * One keyframe value, or `null` when the text is not one this renderer can key.
 *
 * `null` and not NaN: NaN IS a `number`, so it passes every `typeof value ===
 * 'number'` shape check in `clipBuilder`/`valueTracks` and becomes a keyframe
 * that samples NaN for the rest of the clip.
 *
 * A non-finite READ is `null` too — `Color(1e999, 0, 0, 1)` is inside the
 * finite grammar and overflows — since three.js draws an Infinity as NaN
 * geometry. `inf` stays a legal literal; it is simply not renderable here.
 */
function decodeValue(raw: string): GodotKeyframeValue | null {
  // The two literals only, NOT `boolSlotValue`: a keyframe value is an untyped
  // Variant, so there is no BOOL slot to convert toward and `1` is the number
  // one. Booleanizing here turns every scalar track into a constant `true`.
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  for (const { re, read } of COMPOSITE_KEYS) {
    const match = re.exec(raw);
    if (match) {
      const components = read(match);
      return allFinite(components) ? components : null;
    }
  }
  const scalar = parseGodotFloat(raw);
  return scalar !== null && Number.isFinite(scalar) ? scalar : null;
}
