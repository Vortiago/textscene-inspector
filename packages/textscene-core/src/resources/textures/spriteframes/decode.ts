/**
 * SpriteFrames decode — the `animations` property of a `SpriteFrames` resource
 * section (raw Godot text) into per-animation playback data.
 *
 * The serialized form is an array of animation dicts, each shaped like:
 *   [{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }, …],
 *      "loop": true, "name": &"right", "speed": 5.0 }, …]
 *
 * A full GDScript-literal parser is not needed for the preview: split the outer
 * array into its top-level animation dicts (by brace depth), pull each dict's
 * `name`, `speed` (fps) and `loop`, then split its `frames` array the same way
 * and read `texture` + `duration` out of each FRAME dict. (No string-escaped
 * braces appear in these values, so depth tracking is safe without
 * quote-awareness.)
 *
 * Defaults and the duration clamp are Godot's own: `struct Anim { double speed
 * = 5.0; bool loop = true; }` and `float duration = 1.0`
 * (`scene/resources/sprite_frames.h:42-47`), and the `animations` setter clamps
 * every read duration to `MAX(SPRITE_FRAME_MINIMUM_DURATION, duration)`
 * (`sprite_frames.cpp:225`, constant at `sprite_frames.h:35`).
 *
 * Pure `.ts`, no THREE and no React: a decoded SpriteFrames is plain data (the
 * slice has no `build.ts` — nothing here becomes a THREE object; the host
 * resolves each frame ref through the AtlasTexture slice and the texture bus).
 */

import type { SpriteFramesAnimation, SpriteFramesData } from './types';
import { dictNumberField, dictRefField } from '../../../godot/variantParser.js';
import { matchedFloat } from '../../../godot/number.js';
import { boolSlotValue } from '../../../godot/index.js';

/**
 * The dict fields this decoder scrapes, in the grammar Godot's own tokenizer
 * reads rather than a hand-rolled one.
 *
 * Both had drifted narrow. The texture arm spelled the reference without the
 * padding `get_token` discards (variant_parser.cpp:415-417), so an authored
 * `ExtResource( "2" )` went unmatched; `[0-9.]+` for the numbers refused the
 * `1e-05` the writer emits for a small value and the `-` a hand-edited one may
 * carry.
 *
 * Read once per FRAME dict, so neither is `g`-flagged and neither carries a
 * `lastIndex` between frames.
 */
const TEXTURE_REF_RE = dictRefField('texture');
const DURATION_RE = dictNumberField('duration');
const SPEED_RE = dictNumberField('speed');

/** `SPRITE_FRAME_MINIMUM_DURATION` (`scene/resources/sprite_frames.h:35`). */
export const SPRITE_FRAME_MINIMUM_DURATION = 0.01;

/**
 * A `SpriteFrames` section's properties → its animations, or null when the
 * section declares none (absent, non-string, or no parseable animation). Null
 * rather than an empty map because "no animations" and "not a SpriteFrames" are
 * the same thing to every consumer: there is nothing to display.
 */
export function decodeSpriteFrames(properties: Record<string, unknown>): SpriteFramesData | null {
  const value = properties.animations;
  if (typeof value !== 'string') return null;
  const animations = parseSpriteFramesAnimations(value);
  return animations.size > 0 ? { animations } : null;
}

/** animation name → its parsed frames + timing. */
export function parseSpriteFramesAnimations(
  animationsValue: string
): Map<string, SpriteFramesAnimation> {
  const result = new Map<string, SpriteFramesAnimation>();
  for (const block of splitTopLevelDicts(animationsValue, ANIMATION_DICT_DEPTH)) {
    const nameMatch = block.match(/"name"\s*:\s*&?"([^"]*)"/);
    const name = nameMatch ? nameMatch[1]! : 'default';
    // Per FRAME dict, not two scans of the whole block: `frames` and `durations`
    // are then in step by construction. Two independent scans desynchronise
    // whenever one field is spelled in a form the other's grammar misses — a
    // `"texture": null` slot, or a frame dict carrying no `"duration"` — and
    // the count guard that stood here answered a desync by discarding EVERY
    // authored duration, turning a 3-frame [0.5, 3.0, 0.5] blink into 2 frames
    // at 1.0.
    const frameDicts = splitTopLevelDicts(block, FRAME_DICT_DEPTH);
    const frames = frameDicts.map(frameTexture);
    const durations = frameDicts.map(frameDuration);
    const speedMatch = SPEED_RE.exec(block);
    const loopMatch = block.match(/"loop"\s*:\s*(true|false)/);
    result.set(name, {
      name,
      frames,
      durations,
      fps: finiteFps(speedMatch),
      loop: loopMatch ? boolSlotValue(loopMatch[1]) === true : true,
    });
  }
  return result;
}

/**
 * A frame's texture ref, or null when the slot holds no resource.
 *
 * `null` is a real, round-trippable frame: `_get_animations` writes
 * `f["texture"] = anim.frames[i].texture` unconditionally
 * (sprite_frames.cpp:184) and the writer spells a null Ref `null`, while
 * `_set_animations` gates on `f.has("texture")` alone (:222) — true for a null
 * value — and `add_frame` has no null guard (:35-41). So Godot writes and
 * reloads a blank frame, and it must occupy a slot here rather than vanish.
 *
 * Anything else that is not a reference reads as null for the same reason
 * Godot does: a non-Object Variant converts to a null `Ref<Texture2D>`.
 */
function frameTexture(frameDict: string): string | null {
  return TEXTURE_REF_RE.exec(frameDict)?.[1] ?? null;
}

/**
 * A frame's display duration.
 *
 * Godot clamps a read duration to its minimum, so a `0.0` frame blinks rather
 * than lingering (`MAX(SPRITE_FRAME_MINIMUM_DURATION, …)`, sprite_frames.cpp:225).
 * `1e999` overflows to infinity in Godot's reader too, and no frame can last
 * that long here; that and an absent or malformed literal fall back to the API
 * default 1.0 so one such value can't stall playback. Godot instead DROPS a
 * frame dict carrying no `"duration"` (`ERR_CONTINUE(!f.has("duration"))`,
 * :223); the preview keeps the frame, since showing it is closer to the
 * author's intent than silently renumbering the animation.
 */
function frameDuration(frameDict: string): number {
  const match = DURATION_RE.exec(frameDict);
  if (!match) return 1;
  const d = matchedFloat(match[1]!);
  return Number.isFinite(d) ? Math.max(d, SPRITE_FRAME_MINIMUM_DURATION) : 1;
}

/**
 * `"speed"` as a playable rate, or the API default 5 when the key is absent or
 * overflows.
 *
 * `1e999` is inside the finite grammar and reads as infinity, which makes the
 * frame index NaN — the same reason `duration` above falls back rather than
 * carrying the value through.
 */
function finiteFps(speedMatch: RegExpExecArray | null): number {
  if (!speedMatch) return 5;
  const speed = matchedFloat(speedMatch[1]!);
  return Number.isFinite(speed) ? speed : 5;
}

/**
 * Where each level of dict sits, counting every `[` and `{` from the start of
 * the string handed in.
 *
 * In the whole `animations` value the outer array is depth 1 and its animation
 * dicts open at 2. Inside ONE such dict the dict itself is depth 1, its
 * `"frames"` array is 2, and each frame dict opens at 3 — `frames` is the only
 * nested array Godot writes into an animation dict (sprite_frames.cpp:178-188).
 */
const ANIMATION_DICT_DEPTH = 2;
const FRAME_DICT_DEPTH = 3;

/** The substrings of each `{…}` that opens exactly `dictDepth` brackets deep. */
function splitTopLevelDicts(value: string, dictDepth: number): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '[' || c === '{') {
      depth++;
      if (c === '{' && depth === dictDepth) start = i;
    } else if (c === ']' || c === '}') {
      if (c === '}' && depth === dictDepth && start >= 0) {
        blocks.push(value.slice(start, i + 1));
        start = -1;
      }
      depth--;
    }
  }
  return blocks;
}
