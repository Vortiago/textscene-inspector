/**
 * Builds the edit the hot-reload run in `webview-csp-gate.mjs` writes to disk: the
 * same ArrayMesh with an albedo material on its surface. Only the colour changes,
 * so the bounds, and with them the load-time camera fit, stay the same, and the
 * hot-reloaded canvas can be compared exactly with a cold render of the edit.
 */

const MATERIAL_ID = 'StandardMaterial3D_hotreload';

/** The `"index_data": …,` line of each surface, after which Godot writes `"material"`. */
const INDEX_DATA_LINE = /^("index_data": [^\n]*,)$/gm;

/**
 * Gives every surface of an ArrayMesh `.tres` an inline StandardMaterial3D of
 * `albedo`.
 *
 * @param {string} tres ArrayMesh `.tres` text whose surfaces carry no material
 * @param {string} albedo a Godot `Color(…)` literal
 * @returns {string}
 */
export function withSurfaceAlbedo(tres, albedo) {
  if (tres.includes('"material":')) {
    throw new Error('expected an ArrayMesh whose surfaces carry no material, found a "material" key');
  }
  let surfaces = 0;
  const wired = tres.replace(INDEX_DATA_LINE, (line) => {
    surfaces++;
    return `${line}\n"material": SubResource("${MATERIAL_ID}"),`;
  });
  if (surfaces === 0) throw new Error('expected at least one surface with "index_data", found none');
  const material = `[sub_resource type="StandardMaterial3D" id="${MATERIAL_ID}"]\nalbedo_color = ${albedo}\n\n`;
  return wired.replace(/^\[resource\]$/m, `${material}[resource]`);
}
