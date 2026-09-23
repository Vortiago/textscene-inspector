/**
 * The `"values": [...]` half of a value track's key dict: the Variant grammar one keyframe is
 * written in. `animationResolver.ts` assembles tracks and libraries. `null` answers that this
 * renderer cannot key the text. Pure `.ts`, no THREE.
 */

import { variantTupleRegex, parseGodotFloat, allFinite } from '../../../godot/number.js';
import { storedInt } from '../../../godot/int.js';
import { info } from '../../../logger';

/** One keyframe's decoded value: a composite's components, a scalar, or a flag. */
export type GodotKeyframeValue = number[] | number | boolean;

/**
 * The decoded `"values": [...]` array (paren-aware), or `null` when the array is absent,
 * unterminated or holds a key this renderer cannot key. Each drops the whole track, since nothing
 * is left to interpolate through at that key's time, so `[]` means only a genuinely empty array.
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
      // `info`, not `warn`: an unmodelled Variant (`Transform3D`, a dict) and a non-finite
      // component are legal in a sound scene. Unreadable text lands here too, and
      // `parseFloatList` in animationResolver.ts warns on it in a packed array.
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

// NaN, not 0: a component the reader refuses has no value, and `0` is a legal finite one that
// `allFinite` passes, so `Vector3i(99999999999999999999, 0, 0)` would key the node at the origin.
// NaN takes `decodeValue`'s null exit.
const keyInt = (text: string | undefined): number => storedInt(text) ?? NaN;
const keyFloat = (text: string | undefined): number => parseGodotFloat(text ?? '') ?? NaN;

/**
 * Composite keyframe literals, each matched whole by an anchored regex, not a prefix: `Vector2i(…)`
 * starts with `Vector2`, and `SubViewport.size` is `Variant::VECTOR2I` (viewport.cpp:5579).
 * `variantTupleRegex`, not the slot grammar: a keyframe keeps the type the file spells, and the
 * widened `Vector3i` slot grammar truncates a `Vector3` rotation key to whole degrees.
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
 * One keyframe value, or `null` when this renderer cannot key the text. `null`, not NaN: NaN is a
 * `number`, passes every shape check in `clipBuilder` and `valueTracks`, and samples NaN for the
 * rest of the clip. A non-finite read (`Color(1e999, 0, 0, 1)` overflows) is `null` too, since
 * three.js draws Infinity as NaN geometry. `inf` stays a legal literal that this cannot render.
 */
function decodeValue(raw: string): GodotKeyframeValue | null {
  // The two literals only, not `boolSlotValue`: a keyframe value is an untyped
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
