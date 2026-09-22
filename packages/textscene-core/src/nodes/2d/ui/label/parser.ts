/** Label parser — Control + text + alignment. */

import { type ParsedHeading, unquoteString, unquoteStringName } from '../../../../parser/utils';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue, packedArrayBody, packedArrayForms } from '../../../../godot/index.js';
import { floatElements } from '../../../../resources/shapes/packedArray';

const PACKED_FLOAT32_ARRAY_FORMS = packedArrayForms('PackedFloat32Array');

/** `Label.tab_stops` — a plain `PackedFloat32Array(...)` literal; anything else the lenient parser leaves undefined, matching its own leniency elsewhere. */
function parseTabStops(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const matched = packedArrayBody(PACKED_FLOAT32_ARRAY_FORMS, value);
  if (!matched || matched.body === '') return undefined;
  try {
    return matched.flat ? floatElements(matched.body, 'PackedFloat32Array', value) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Godot's `Label` constructor calls `set_v_size_flags(SIZE_SHRINK_CENTER)`, so
 * a Label in a box container shrinks to its text height and centres on the
 * cross axis rather than filling it (which would pin its top-aligned text to
 * the top). Base `Control` defaults to `SIZE_FILL`, so this override lives here,
 * only when the scene doesn't set `size_flags_vertical` itself.
 */
const LABEL_DEFAULT_V_SIZE_FLAGS = 4; // SIZE_SHRINK_CENTER

interface VisibleCharsState {
  visibleChars: number;
  visibleRatio: number;
}

/** `Label`'s own construction defaults (label.h:75-76). */
const DEFAULT_VISIBLE_CHARS_STATE: VisibleCharsState = { visibleChars: -1, visibleRatio: 1 };

/** `Label::set_visible_characters` (label.cpp:1285-1299) — a no-op once `p_amount` already matches the current field, else fully re-derives both fields from the CURRENT text length. */
function applySetVisibleCharacters(state: VisibleCharsState, amount: number, totalChars: number): VisibleCharsState {
  if (state.visibleChars === amount) return state;
  if (amount === -1 || totalChars === 0) return { visibleChars: amount, visibleRatio: 1 };
  return { visibleChars: amount, visibleRatio: amount / totalChars };
}

/** `Label::set_visible_ratio` (label.cpp:1305-1323) — likewise a no-op once `p_ratio` already matches the current field. */
function applySetVisibleRatio(state: VisibleCharsState, ratio: number, totalChars: number): VisibleCharsState {
  if (state.visibleRatio === ratio) return state;
  if (ratio >= 1) return { visibleChars: -1, visibleRatio: 1 };
  if (ratio < 0) return { visibleChars: 0, visibleRatio: 0 };
  return { visibleChars: Math.trunc(totalChars * ratio), visibleRatio: ratio };
}

/**
 * `visible_characters`/`visible_ratio` cross-derive each other, and each
 * setter's WHOLE body is gated on its own field actually changing
 * (label.cpp:1286,1306), so the final state depends on which one a scene
 * writes LAST — Godot applies `_set` in the file's own property order
 * (packed_scene.cpp:492). Replays whichever of the two are authored, in the
 * order this parser's raw property bag preserves (insertion order == file
 * order, `TscnParserCore.ts`'s scanning loop), against `Label`'s own
 * construction defaults. Assumes `text` is already applied — every real
 * Godot save writes it first (`ADD_PROPERTY`, label.cpp:1431), well ahead of
 * the "Displayed Text" group these two belong to; a hand-edited file that
 * writes `text` AFTER either is read as if `text` came first.
 */
function resolveVisibleChars(properties: Record<string, string>, textLength: number): VisibleCharsState | undefined {
  const rawChars = properties.visible_characters;
  const rawRatio = properties.visible_ratio;
  if (rawChars === undefined && rawRatio === undefined) return undefined;

  let state = DEFAULT_VISIBLE_CHARS_STATE;
  for (const key of Object.keys(properties)) {
    if (key === 'visible_characters') {
      const amount = parseOptionalInt(rawChars);
      if (amount !== undefined) state = applySetVisibleCharacters(state, amount, textLength);
    } else if (key === 'visible_ratio') {
      const ratio = parseOptionalFloat(rawRatio);
      if (ratio !== undefined) state = applySetVisibleRatio(state, ratio, textLength);
    }
  }
  return state;
}

export function parseLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (result.sizeFlagsVertical === undefined) {
    result.sizeFlagsVertical = LABEL_DEFAULT_V_SIZE_FLAGS;
  }
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  if (boolSlotValue(properties.uppercase) === true) result.uppercase = true;
  result.overrunBehavior = parseOptionalInt(properties.text_overrun_behavior);
  if (boolSlotValue(properties.clip_text) === true) result.clipText = true;
  // label.cpp:1259-1261 -- `set_ellipsis_char` keeps only the first character.
  if (properties.ellipsis_char !== undefined) {
    result.ellipsisChar = unquoteStringName(properties.ellipsis_char).slice(0, 1) || undefined;
  }
  // int64: a `BitField` slot, and the validator declares it so — the two must
  // agree or a value past 2^31 reads as a different number than Godot stores.
  result.justificationFlags = parseOptionalInt(properties.justification_flags, 'int64');
  result.tabStopsPx = parseTabStops(properties.tab_stops);
  result.autowrapTrimFlags = parseOptionalInt(properties.autowrap_trim_flags, 'int64');
  // label.cpp:1198-1205 -- assigned unconditionally; `c_unescape()` is not
  // ported (no shared reader for it — see comparison.md), so a doubly-escaped
  // literal (`"\\n"`) is kept literal rather than decoded to a control character.
  if (properties.paragraph_separator !== undefined) {
    result.paragraphSeparator = unquoteString(properties.paragraph_separator);
  }
  result.linesSkipped = parseOptionalInt(properties.lines_skipped);
  result.maxLinesVisible = parseOptionalInt(properties.max_lines_visible);
  if (properties.label_settings !== undefined) result.labelSettings = properties.label_settings.trim();
  const visibleState = resolveVisibleChars(properties, (result.text ?? '').length);
  if (visibleState) {
    result.visibleCharacters = visibleState.visibleChars;
    result.visibleRatio = visibleState.visibleRatio;
  }
  result.visibleCharactersBehavior = parseOptionalInt(properties.visible_characters_behavior);
  return result;
}
