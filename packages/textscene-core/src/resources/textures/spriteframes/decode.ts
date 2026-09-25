/**
 * SpriteFrames decode: the `animations` text, an array of dicts such as
 * `[{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }], "loop": true,
 * "name": &"right", "speed": 5.0 }]`, split by brace depth and read as
 * `_set_animations` does (sprite_frames.cpp:195-230). No THREE, no React.
 */

import type { SpriteFramesAnimation, SpriteFramesData } from './types';
import { dictNumberField, dictStringField } from '../../../godot/variantParser.js';
import { matchedFloat } from '../../../godot/number.js';
import { boolSlotValue, keyedResourceRefReader, resourceRef } from '../../../godot/index.js';
import { ANIMATION_DICT_DEPTH, splitFramesArray, splitTopLevelDicts } from './frameSplit.js';
import { unquoteLiteral } from '../../../parser/utils.js';

/**
 * The frame's texture ref, or null. Godot writes a null Ref as `null`
 * (`_get_animations`, sprite_frames.cpp:184) and reloads it (:222, no null guard
 * in `add_frame` at :35-41), so a blank frame keeps its slot. A non-Object
 * Variant also converts to a null `Ref<Texture2D>`.
 */
const frameTexture = keyedResourceRefReader('texture');
// Godot's tokenizer grammar, which reads the writer's `1e-05` and a hand-edited
// `-`. Read once per frame dict, so neither is `g`-flagged or carries a `lastIndex`.
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

/** The `"name"` value: one string literal, escapes and all, with an optional `&` or `@` sigil. */
const NAME_RE = dictStringField('name');

/** `SPRITE_FRAME_MINIMUM_DURATION` (`scene/resources/sprite_frames.h:35`). */
export const SPRITE_FRAME_MINIMUM_DURATION = 0.01;

/**
 * A `SpriteFrames` section's animations, or null when it declares none: to every
 * consumer, no animations and not a SpriteFrames both mean nothing to display.
 */
export function decodeSpriteFrames(properties: Record<string, unknown>): SpriteFramesData | null {
  const value = properties.animations;
  if (typeof value !== 'string') return null;
  const animations = parseSpriteFramesAnimations(value);
  return animations.size > 0 ? { animations } : null;
}

/** Animation name to its parsed frames and timing. */
export function parseSpriteFramesAnimations(
  animationsValue: string
): Map<string, SpriteFramesAnimation> {
  const result = new Map<string, SpriteFramesAnimation>();
  for (const block of splitTopLevelDicts(animationsValue, ANIMATION_DICT_DEPTH)) {
    if (!ANIMATION_KEYS_RE.every((re) => re.test(block))) continue;
    // `animations[d["name"]] = anim` (:229) keys on the Variant as a StringName;
    // only the string spelling the writer emits is read, escapes decoded.
    const nameMatch = NAME_RE.exec(block);
    if (!nameMatch) continue;
    const name = unquoteLiteral(nameMatch[1]!);
    // One read per frame element keeps `frames` and `durations` in step, whatever
    // spelling either takes (`"texture": null`, a bare ref).
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
 * The frames of one animation dict, as `_set_animations` reads them
 * (sprite_frames.cpp:209-227). A bare ref loads as a 1.0 frame (`DISABLE_DEPRECATED`,
 * :210-217). A dict lacking either key is skipped (`ERR_CONTINUE(!f.has("texture"));
 * ERR_CONTINUE(!f.has("duration"))`, :222-223), and so is any other Variant.
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
 * A frame's display duration, key present. Godot clamps it, so a `0.0` frame
 * blinks (`MAX(SPRITE_FRAME_MINIMUM_DURATION, …)`, sprite_frames.cpp:225, constant at
 * `sprite_frames.h:35`). An
 * infinite `1e999` or a malformed literal falls back to 1.0, so playback never stalls.
 */
function frameDuration(frameDict: string): number {
  const match = DURATION_RE.exec(frameDict);
  if (!match) return 1;
  const d = matchedFloat(match[1]!);
  return Number.isFinite(d) ? Math.max(d, SPRITE_FRAME_MINIMUM_DURATION) : 1;
}

/**
 * `"speed"` as a playable rate, key present. The `Anim` default 5
 * (`sprite_frames.h:45`) replaces a non-finite value such as `1e999`, which would
 * make the frame index NaN.
 */
function finiteFps(speedMatch: RegExpExecArray | null): number {
  if (!speedMatch) return 5;
  const speed = matchedFloat(speedMatch[1]!);
  return Number.isFinite(speed) ? speed : 5;
}
