/**
 * The .tscn script-strip, apart from the vendoring flow: the entry point runs on import, so a
 * helper beside it could not be run on its own.
 */

/**
 * Removes every `[ext_resource type="Script" …]` header and `script = ExtResource(…)` line, since
 * no .cs or .gd is vendored, and recomputes `load_steps` (1 + ext_resources + sub_resources). The
 * rest stays byte for byte, so it is idempotent. The filter is line-based, so a multiline string
 * whose continuation matches would be damaged, and the curated corpus holds none.
 * @param {string} text
 * @returns {string}
 */
export function stripScripts(text) {
  const lines = text.split('\n');
  const kept = lines.filter((line) => {
    if (/^\[ext_resource\b/.test(line) && line.includes('type="Script"')) return false;
    if (/^\s*script\s*=\s*ExtResource\(/.test(line)) return false;
    return true;
  });

  const extCount = kept.filter((line) => /^\[ext_resource\b/.test(line)).length;
  const subCount = kept.filter((line) => /^\[sub_resource\b/.test(line)).length;
  const loadSteps = 1 + extCount + subCount;

  const headerIdx = kept.findIndex((line) => /^\[gd_scene\b/.test(line));
  if (headerIdx !== -1) kept[headerIdx] = rewriteLoadSteps(kept[headerIdx], loadSteps);

  return kept.join('\n');
}

/**
 * Rewrite the `[gd_scene …]` header's `load_steps` to `steps`, matching Godot's
 * own output: present only when > 1, otherwise omitted entirely.
 * @param {string} header
 * @param {number} steps
 * @returns {string}
 */
function rewriteLoadSteps(header, steps) {
  const hasLoadSteps = /\bload_steps=\d+/.test(header);
  if (steps > 1) {
    return hasLoadSteps
      ? header.replace(/\bload_steps=\d+/, `load_steps=${steps}`)
      : header.replace(/^\[gd_scene\b/, `[gd_scene load_steps=${steps}`);
  }
  return hasLoadSteps ? header.replace(/\bload_steps=\d+\s*/, '') : header;
}
