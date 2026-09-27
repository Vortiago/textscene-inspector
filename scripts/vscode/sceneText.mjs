/**
 * Builds the text-free twin of a `.tscn`, the negative control in
 * `webview-csp-gate.mjs`. It is derived at run time, since a committed copy
 * drifts when the fixture changes. Only the glyphs differ, so ink that
 * survives the blanking is ink the text pipeline did not paint.
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
