/**
 * The bracket scanners behind the SpriteFrames decode: where each animation dict
 * sits in the `animations` value, and the elements of one dict's `frames` array.
 * Depth counting only — no string-escaped braces appear in these values.
 */

const FRAMES_ARRAY_RE = /"frames"\s*:\s*\[/;

/**
 * Where an animation dict sits, counting every `[` and `{` from the start of the
 * `animations` value: the outer array is depth 1 and each dict opens at 2.
 */
export const ANIMATION_DICT_DEPTH = 2;

/**
 * The elements of the `"frames"` array inside one animation dict, trimmed —
 * split on the commas at the array's own depth, so a dict element arrives
 * whole. `frames` is the only nested array Godot writes into an animation dict
 * (sprite_frames.cpp:178-188).
 */
export function splitFramesArray(block: string): string[] {
  const open = FRAMES_ARRAY_RE.exec(block);
  if (!open) return [];
  const elements: string[] = [];
  const push = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) elements.push(trimmed);
  };
  let depth = 0;
  let start = open.index + open[0].length;
  for (let i = start; i < block.length; i++) {
    const c = block[i];
    if (c === '[' || c === '{') {
      depth++;
    } else if (c === ']' || c === '}') {
      if (depth === 0) {
        push(block.slice(start, i));
        return elements;
      }
      depth--;
    } else if (c === ',' && depth === 0) {
      push(block.slice(start, i));
      start = i + 1;
    }
  }
  return elements;
}

/** The substrings of each `{…}` that opens exactly `dictDepth` brackets deep. */
export function splitTopLevelDicts(value: string, dictDepth: number): string[] {
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
