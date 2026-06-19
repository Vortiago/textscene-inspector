/**
 * Parses a Godot `SpriteFrames.animations` value into per-animation playback
 * data (ordered frame texture refs + timing), and resolves the displayed frame
 * for a given playhead.
 *
 * The serialized form is an array of animation dicts, each shaped like:
 *   [{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }, …],
 *      "loop": true, "name": &"right", "speed": 5.0 }, …]
 *
 * We don't need a full GDScript-literal parser for the preview: split the outer
 * array into its top-level animation dicts (by brace depth), then per dict pull
 * the `name`, the ordered `texture` refs + per-frame `duration`s, the `speed`
 * (fps) and the `loop` flag. (No string-escaped braces appear in these values,
 * so depth tracking is safe without quote-awareness.)
 */

/** One parsed SpriteFrames animation: ordered frames plus playback timing. */
export interface SpriteFramesAnimation {
  name: string;
  /** Ordered frame texture refs (e.g. `ExtResource("2")`). */
  frames: string[];
  /** Per-frame duration multipliers, parallel to `frames` (Godot default 1.0). */
  durations: number[];
  /** Playback rate in frames/second (`speed`; Godot default 5). */
  fps: number;
  /** Whether the animation loops (Godot default true). */
  loop: boolean;
}

/** animation name → its parsed frames + timing. */
export function parseSpriteFramesAnimations(animationsValue: string): Map<string, SpriteFramesAnimation> {
  const result = new Map<string, SpriteFramesAnimation>();
  for (const block of splitTopLevelDicts(animationsValue)) {
    const nameMatch = block.match(/"name"\s*:\s*&?"([^"]*)"/);
    const name = nameMatch ? nameMatch[1]! : 'default';
    const frames = [
      ...block.matchAll(/"texture"\s*:\s*((?:Ext|Sub)Resource\("[^"]+"\))/g),
    ].map((m) => m[1]!);
    const durations = [...block.matchAll(/"duration"\s*:\s*([0-9.]+)/g)].map((m) => {
      // Sanitize a malformed/non-positive capture (e.g. "1.2.3" → NaN) to the
      // default 1.0 so one bad value can't stall playback (NaN → frozen frame).
      const d = Number(m[1]);
      return Number.isFinite(d) && d > 0 ? d : 1;
    });
    const speedMatch = block.match(/"speed"\s*:\s*([0-9.]+)/);
    const loopMatch = block.match(/"loop"\s*:\s*(true|false)/);
    result.set(name, {
      name,
      frames,
      // Per-frame durations only when one was captured per frame; else uniform.
      durations: durations.length === frames.length ? durations : frames.map(() => 1),
      fps: speedMatch ? Number(speedMatch[1]) : 5,
      loop: loopMatch ? loopMatch[1] === 'true' : true,
    });
  }
  return result;
}

/**
 * The frame index to display at `elapsed` seconds into an animation. Each frame
 * `i` shows for `durations[i] / fps` seconds (Godot's SpriteFrames timing).
 * Loops when `loop`, else holds the final frame. Degenerate animations (≤1
 * frame, fps ≤ 0, or t ≤ 0) stay on frame 0.
 */
export function frameAtTime(animation: SpriteFramesAnimation, elapsed: number): number {
  const n = animation.frames.length;
  if (n <= 1 || animation.fps <= 0 || elapsed <= 0) return 0;

  const frameTimes = animation.durations.map((d) => d / animation.fps);
  const total = frameTimes.reduce((sum, t) => sum + t, 0);
  if (!(total > 0)) return 0; // also catches NaN (a malformed duration)

  let t = elapsed;
  if (animation.loop) t = elapsed % total;
  else if (elapsed >= total) return n - 1;

  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += frameTimes[i]!;
    if (t < acc) return i;
  }
  return n - 1;
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
