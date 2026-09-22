/**
 * Builds the text-free twin of a `.tscn` used as the negative control in
 * `webview-csp-gate.mjs`.
 *
 * The twin is derived from the real fixture at run time rather than committed
 * beside it: a committed copy drifts silently the moment the fixture is edited,
 * and the whole point of the control is that the two scenes differ in exactly
 * one thing — whether any glyph is asked for. Everything else (node types,
 * anchors, rects) stays byte-identical, so ink that survives the blanking is
 * ink the text pipeline did not paint.
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
