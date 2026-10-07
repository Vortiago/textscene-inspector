/**
 * Builds the twins of a `.tscn` that `webview-csp-gate.mjs` compares a scene
 * against: one with every text emptied, one with a node hidden. They are derived
 * at run time, since a committed copy drifts when the fixture changes. A twin
 * differs from its scene in one thing, so a pixel the two do not share is a
 * pixel that one thing painted.
 */

/**
 * A `text = "…"` assignment, anchored per line so a `text` substring inside another
 * value is never touched. `\` takes the next character, a raw newline too
 * (`variant_parser.cpp:276-290`): core's `STRING_LITERAL_SOURCE`, copied since this runs unbuilt.
 */
const TEXT_ASSIGNMENT = /^(\s*text = )"(?:[^"\\]|\\[\s\S])*"/gm;

/**
 * Empties every `text = "…"` assignment.
 *
 * @param {string} source `.tscn` text
 * @returns {{ source: string, replacements: number }}
 */
export function blankSceneText(source) {
  let replacements = 0;
  const blanked = source.replace(TEXT_ASSIGNMENT, (_match, assignment) => {
    replacements++;
    return `${assignment}""`;
  });
  return { source: blanked, replacements };
}

/**
 * Hides the node `name` by giving it `visible = false`, the line Godot itself
 * writes, right under its `[node]` header.
 *
 * @param {string} source `.tscn` text
 * @param {string} name the node's `name`
 * @returns {string}
 */
export function hideSceneNode(source, name) {
  const literalName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const header = new RegExp(`^\\[node name="${literalName}"[^\\n]*\\]$`, 'm');
  const match = header.exec(source);
  if (!match) throw new Error(`expected a [node name="${name}"] header, found none`);
  const end = match.index + match[0].length;
  return `${source.slice(0, end)}\nvisible = false${source.slice(end)}`;
}
