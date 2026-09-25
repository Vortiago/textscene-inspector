/**
 * In-memory files for the sweeps in `godot-source-decoupling.test.mjs`, so its controls prove what
 * the patterns catch whatever the repo holds. This module carries the offending strings, so it is
 * on both allowlists, and a scratch file on disk that held them would be a real violation.
 */

/**
 * Every row has to be able to fail. A tag row names a version OTHER than the
 * current pin, or the whole arm could be rewritten as the `4.6.3` literal and
 * still pass; `4.10` fails a `\d` that is not `\d+`; the backslash row fails a
 * separator class narrowed to `/`.
 */
export const CHECKOUT_CONTROLS = [
  {
    file: 'scratch/tag-current.ts',
    hit: true,
    body: "readFileSync('/home/dev/godot-4.6.3/scene/3d/light_3d.cpp')",
  },
  {
    file: 'scratch/tag-next.ts',
    hit: true,
    body: "readFileSync('/home/dev/godot-4.7.0/scene/3d/light_3d.cpp')",
  },
  { file: 'scratch/tag-two-part.mjs', hit: true, body: "const root = '/opt/godot-4.10/doc';" },
  {
    file: 'scratch/repos-posix.ts',
    hit: true,
    body: "join(HOME, '/repos/godot/doc/classes/Range.xml')",
  },
  {
    file: 'scratch/repos-windows.ts',
    hit: true,
    body: 'join(HOME, "\\repos\\godot\\doc\\classes\\Range.xml")',
  },
  {
    file: 'scratch/segments.mjs',
    hit: true,
    body: "readFileSync(join(REPO, '..', 'godot', 'scene', '3d', 'light_3d.cpp'))",
  },
  {
    file: 'scratch/segments-double.ts',
    hit: true,
    body: 'join(HOME, "godot", "doc", "classes", "Range.xml")',
  },
  {
    file: 'scratch/slash-path.ts',
    hit: true,
    body: "resolve(HOME, 'godot/modules/gltf/gltf_document.cpp')",
  },
  // Citing where a bound came from is the encouraged practice, not a hit.
  {
    file: 'scratch/citation.ts',
    hit: false,
    body: '// scene/3d/camera_3d.cpp:682\n// default per doc/classes/Range.xml',
  },
  // A `godot` directory holding something other than the engine tree.
  {
    file: 'scratch/projects.ts',
    hit: false,
    body: "join(HOME, 'godot', 'projects', 'demo.tscn'); // ~/godot/projects/demo.tscn",
  },
  {
    file: 'scratch/doc-link.mjs',
    hit: false,
    body: "const tree = 'https://api.github.com/repos/godotengine/godot/git/trees/master';",
  },
];

/**
 * One row per read form, plus one per name that would be the first to be
 * narrowed back to a roster: a suffix the roster never listed, and the
 * one-off `GODOT_PATH`.
 */
export const ENV_CONTROLS = [
  { file: 'scratch/env-src.ts', hit: true, body: 'const root = process.env.GODOT_SRC;' },
  { file: 'scratch/env-path.ts', hit: true, body: 'const root = process.env.GODOT_PATH;' },
  { file: 'scratch/env-any.ts', hit: true, body: 'const root = process.env.GODOT_UPSTREAM_DIR;' },
  { file: 'scratch/env-bracket.mjs', hit: true, body: "process.env['GODOT_CHECKOUT'] ?? ''" },
  { file: 'scratch/env-bracket-double.mjs', hit: true, body: 'process.env["GODOT_ENGINE"]' },
  { file: 'scratch/env-destructured.ts', hit: true, body: 'const { env } = process; env.GODOT_ROOT' },
  { file: 'scratch/env-shell.sh', hit: true, body: 'godot --path "$GODOT_SRC/demos"' },
  { file: 'scratch/env-workflow.yml', hit: true, body: 'run: ls ${GODOT_SOURCE}/scene' },
  // A path to the godot BINARY is a tool, and prose may name the variable.
  { file: 'scratch/env-binary.ts', hit: false, body: "process.env.GODOT_BIN ?? 'godot'" },
  { file: 'scratch/env-prose.md', hit: false, body: 'Export `GODOT_SRC` before authoring.' },
  // This repo's own constants share the prefix; neither names the checkout.
  { file: 'scratch/env-constant.ts', hit: false, body: 'const GODOT_PI = 3.1415927;' },
  { file: 'scratch/env-template.ts', hit: false, body: 'const glsl = `${GODOT_TO_SRGB_GLSL}`;' },
];
