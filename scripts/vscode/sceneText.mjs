/**
 * Builds the text-free twin of a `.tscn`, the negative control in
 * `webview-csp-gate.mjs`. It is derived at run time, since a committed copy
 * drifts when the fixture changes. Only the glyphs differ, so ink that
 * survives the blanking is ink the text pipeline did not paint.
 */

/**
 * A quoted `.tscn` string value: no bare `"`, backslash escapes allowed
 * through. Anchored per-line to a `text = ` assignment so a `text` substring
 * inside some other value is never touched.
 */
const TEXT_ASSIGNMENT = /^(\s*text = )"(?:[^"\\]|\\.)*"/gm;

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
