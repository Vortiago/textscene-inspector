/**
 * SpriteFrames decode — the `animations` property of a `SpriteFrames` resource
 * section (raw Godot text) into per-animation playback data.
 *
 * The serialized form is an array of animation dicts, each shaped like:
 *   [{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }, …],
 *      "loop": true, "name": &"right", "speed": 5.0 }, …]
 *
 * A full GDScript-literal parser is not needed for the preview: split the outer
 * array into its top-level animation dicts (by brace depth) and read each the
 * way `_set_animations` does (sprite_frames.cpp:195-230). A dict lacking any of
 * `name`, `speed`, `loop`, `frames` is dropped (:200-203); otherwise its
 * `frames` array is walked element by element (:209-227): a bare resource ref
 * is a 1.0 frame, a dict is read for `texture` + `duration` and dropped when it
 * lacks either key, anything else is dropped. (No string-escaped braces appear
 * in these values, so depth tracking is safe without quote-awareness.)
 *
 * The duration clamp is Godot's own: every read duration becomes
 * `MAX(SPRITE_FRAME_MINIMUM_DURATION, duration)` (`sprite_frames.cpp:225`,
 * constant at `sprite_frames.h:35`).
 *
 * Pure `.ts`, no THREE and no React: a decoded SpriteFrames is plain data (the
 * slice has no `build.ts` — nothing here becomes a THREE object; the host
 * resolves each frame ref through the AtlasTexture slice and the texture bus).
 */

import type { SpriteFramesAnimation, SpriteFramesData } from './types';
import { dictNumberField } from '../../../godot/variantParser.js';
import { matchedFloat } from '../../../godot/number.js';
import { boolSlotValue, keyedResourceRefReader, resourceRef } from '../../../godot/index.js';
import { ANIMATION_DICT_DEPTH, splitFramesArray, splitTopLevelDicts } from './frameSplit.js';

/**
 * The dict fields this decoder scrapes, in the grammar Godot's own tokenizer
 * reads rather than a hand-rolled one: `[0-9.]+` refused the `1e-05` the
 * writer emits for a small value and the `-` a hand-edited one may carry.
 * Read once per FRAME dict, so none is `g`-flagged and none carries a
 * `lastIndex` between frames.
 *
 * The texture reader yields the frame's ref, or null when the slot holds no
 * resource. `null` is a real, round-trippable frame: `_get_animations` writes
 * `f["texture"] = anim.frames[i].texture` unconditionally
 * (sprite_frames.cpp:184) and the writer spells a null Ref `null`, while
 * `_set_animations` gates on `f.has("texture")` (:222) — true for a null
 * value — and `add_frame` has no null guard (:35-41). So Godot writes and
 * reloads a blank frame, and it must occupy a slot here rather than vanish.
 *
 * Anything else that is not a reference reads as null for the same reason
 * Godot does: a non-Object Variant converts to a null `Ref<Texture2D>`.
 */
const frameTexture = keyedResourceRefReader('texture');
const DURATION_RE = dictNumberField('duration');
const SPEED_RE = dictNumberField('speed');

/**
 * The four keys an animation dict must carry to become an animation at all
 * (`ERR_CONTINUE(!d.has(…))`, sprite_frames.cpp:200-203). Presence only, as
 * `Dictionary::has` is: the value's form is read afterwards.
 */
const ANIMATION_KEYS_RE = ['name', 'speed', 'loop', 'frames'].map(
  (key) => new RegExp(`"${key}"\\s*:`)
);

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
    if (!ANIMATION_KEYS_RE.every((re) => re.test(block))) continue;
    // `animations[d["name"]] = anim` (:229) keys on the Variant as a StringName;
    // only the string spelling the writer emits is read.
    const nameMatch = block.match(/"name"\s*:\s*&?"([^"]*)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1]!;
    // Per FRAME element, not two scans of the whole block: `frames` and
    // `durations` are then in step by construction, whatever spelling either
    // field takes (`"texture": null`, a bare ref).
    const frames = readFrames(block);
    const speedMatch = SPEED_RE.exec(block);
    const loopMatch = block.match(/"loop"\s*:\s*(true|false)/);
    result.set(name, {
      name,
      frames: frames.map((f) => f.texture),
      durations: frames.map((f) => f.duration),
      fps: finiteFps(speedMatch),
      loop: loopMatch ? boolSlotValue(loopMatch[1]) === true : true,
    });
  }
  return result;
}

/** One frame the loader keeps: its texture ref (null for an empty slot) and duration. */
interface Frame {
  texture: string | null;
  duration: number;
}

const TEXTURE_KEY_RE = /"texture"\s*:/;
const DURATION_KEY_RE = /"duration"\s*:/;

/**
 * The frames of one animation dict, element by element as `_set_animations`
 * reads them (sprite_frames.cpp:209-227).
 *
 * A bare resource ref is the pre-4.0 spelling and loads as a 1.0 frame
 * (`#ifndef DISABLE_DEPRECATED … Frame frame = { res, 1.0 }`, :210-217). A dict
 * must carry BOTH keys or it is skipped and the frames after it shift down
 * (`ERR_CONTINUE(!f.has("texture")); ERR_CONTINUE(!f.has("duration"))`,
 * :222-223). Any other bare Variant is an invalid `Ref<Resource>` and then an
 * empty `Dictionary`, so the same `ERR_CONTINUE` drops it.
 */
function readFrames(block: string): Frame[] {
  const frames: Frame[] = [];
  for (const element of splitFramesArray(block)) {
    if (element.startsWith('{')) {
      if (!TEXTURE_KEY_RE.test(element) || !DURATION_KEY_RE.test(element)) continue;
      frames.push({ texture: frameTexture(element), duration: frameDuration(element) });
    } else if (resourceRef(element)) {
      frames.push({ texture: element, duration: 1 });
    }
  }
  return frames;
}

/**
 * A frame's display duration; the key is known to be present.
 *
 * Godot clamps a read duration to its minimum, so a `0.0` frame blinks rather
 * than lingering (`MAX(SPRITE_FRAME_MINIMUM_DURATION, …)`, sprite_frames.cpp:225).
 * `1e999` overflows to infinity in Godot's reader too, and no frame can last
 * that long here; that and a malformed literal fall back to the API default
 * 1.0 so one such value can't stall playback.
 */
function frameDuration(frameDict: string): number {
  const match = DURATION_RE.exec(frameDict);
  if (!match) return 1;
  const d = matchedFloat(match[1]!);
  return Number.isFinite(d) ? Math.max(d, SPRITE_FRAME_MINIMUM_DURATION) : 1;
}

/**
 * `"speed"` as a playable rate; the key is known to be present. The `Anim`
 * default 5 (`sprite_frames.h:45`) stands in for a value that is not a finite
 * number: `1e999` is inside the finite grammar and reads as infinity, which
 * makes the frame index NaN — the same reason `duration` above falls back
 * rather than carrying the value through.
 */
function finiteFps(speedMatch: RegExpExecArray | null): number {
  if (!speedMatch) return 5;
  const speed = matchedFloat(speedMatch[1]!);
  return Number.isFinite(speed) ? speed : 5;
}
