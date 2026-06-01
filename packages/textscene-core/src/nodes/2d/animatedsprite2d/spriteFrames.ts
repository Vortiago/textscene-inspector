/**
 * Parses a Godot `SpriteFrames.animations` value into a map of
 * animation name → ordered frame texture references.
 *
 * The serialized form is an array of animation dicts, each shaped like:
 *   [{ "frames": [{ "duration": 1.0, "texture": ExtResource("2") }, …],
 *      "loop": true, "name": &"right", "speed": 5.0 }, …]
 *
 * We don't need a full GDScript-literal parser for the preview: split the outer
 * array into its top-level animation dicts (by brace depth), then per dict pull
 * the `name` and the ordered `texture` ExtResource/SubResource refs from its
 * frames. (No string-escaped braces appear in these values, so depth tracking
 * is safe without quote-awareness.)
 */

/** animation name → ordered frame texture refs (e.g. `ExtResource("2")`). */
export function parseSpriteFramesAnimations(animationsValue: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const block of splitTopLevelDicts(animationsValue)) {
    const nameMatch = block.match(/"name"\s*:\s*&?"([^"]*)"/);
    const name = nameMatch ? nameMatch[1]! : 'default';
    const textures = [
      ...block.matchAll(/"texture"\s*:\s*((?:Ext|Sub)Resource\("[^"]+"\))/g),
    ].map((m) => m[1]!);
    result.set(name, textures);
  }
  return result;
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
