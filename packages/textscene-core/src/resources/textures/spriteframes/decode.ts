/**
 * SpriteFrames decode — the `animations` property of a `SpriteFrames` resource
 * section (raw Godot text) into per-animation playback data.
 *
 * The serialized form is an array of animation dicts, each shaped like:
 *   [{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }, …],
 *      "loop": true, "name": &"right", "speed": 5.0 }, …]
 *
 * A full GDScript-literal parser is not needed for the preview: split the outer
 * array into its top-level animation dicts (by brace depth), then per dict pull
 * the `name`, the ordered `texture` refs + per-frame `duration`s, the `speed`
 * (fps) and the `loop` flag. (No string-escaped braces appear in these values,
 * so depth tracking is safe without quote-awareness.)
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

/**
 * The dict fields this decoder scrapes, in the grammar Godot's own tokenizer
 * reads rather than a hand-rolled one.
 *
 * Both had drifted narrow. The texture arm spelled the reference without the
 * padding `get_token` discards (variant_parser.cpp:415-417), so an authored
 * `ExtResource( "2" )` went unmatched; `[0-9.]+` for the numbers refused the
 * `1e-05` the writer emits for a small value and the `-` a hand-edited one may
 * carry. Either miss desynchronises `durations` from `frames`, and the
 * frame-count guard below then throws away EVERY authored duration.
 */
const TEXTURE_REF_RE = dictRefField('texture', true);
const DURATION_RE = dictNumberField('duration', true);
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
  for (const block of splitTopLevelDicts(animationsValue)) {
    const nameMatch = block.match(/"name"\s*:\s*&?"([^"]*)"/);
    const name = nameMatch ? nameMatch[1]! : 'default';
    // `matchAll` clones the regex it is handed and leaves the original's
    // `lastIndex` at 0, so these shared `g` instances stay stateless.
    const frames = [...block.matchAll(TEXTURE_REF_RE)].map((m) => m[1]!);
    const durations = [...block.matchAll(DURATION_RE)].map((m) => {
      const d = matchedFloat(m[1]!);
      // Godot clamps a read duration to its minimum, so a `0.0` frame blinks
      // rather than lingering. `1e999` overflows to infinity in Godot's reader
      // too, and no frame can last that long here; fall back to the API default
      // 1.0 so one such value can't stall playback.
      return Number.isFinite(d) ? Math.max(d, SPRITE_FRAME_MINIMUM_DURATION) : 1;
    });
    const speedMatch = SPEED_RE.exec(block);
    const loopMatch = block.match(/"loop"\s*:\s*(true|false)/);
    result.set(name, {
      name,
      frames,
      // Per-frame durations only when one was captured per frame; else uniform.
      durations: durations.length === frames.length ? durations : frames.map(() => 1),
      fps: finiteFps(speedMatch),
      loop: loopMatch ? loopMatch[1] === 'true' : true,
    });
  }
  return result;
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

/** The substrings of each `{…}` opened at array-depth 1 (the animation dicts). */
function splitTopLevelDicts(value: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '[' || c === '{') {
      depth++;
      if (c === '{' && depth === 2) start = i; // outer array is depth 1; its dicts open at 2
    } else if (c === ']' || c === '}') {
      if (c === '}' && depth === 2 && start >= 0) {
        blocks.push(value.slice(start, i + 1));
        start = -1;
      }
      depth--;
    }
  }
  return blocks;
}
