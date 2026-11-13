/**
 * Where a generator finds Godot's source: `/opt/godot-source` in the CI image
 * (`.github/ci-image/Dockerfile`), or the directory a local run passes as `--godot-source <dir>`.
 * Only the generators in GODOT_SOURCE_READERS of `godot-source-decoupling.test.mjs` read it.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The source tree of the CI image, at the tag of its Godot binary. */
export const GODOT_SOURCE_DIR = '/opt/godot-source';

/** A file every Godot 4 tree holds, so a wrong directory fails here and not in a parse. */
const MARKER = 'servers/rendering/shader_language.cpp';

/**
 * The source directory for `argv`: the value after `--godot-source`, or the CI image's. Throws,
 * naming how to get the source, when the directory holds no Godot tree.
 */
export function godotSourceDir(argv) {
  const flag = argv.indexOf('--godot-source');
  const dir = flag >= 0 ? resolve(argv[flag + 1] ?? '') : GODOT_SOURCE_DIR;
  if (existsSync(join(dir, MARKER))) return dir;
  throw new Error(
    `expected Godot's source at ${dir}, found no ${MARKER}. Run in the CI image, which holds it at ` +
      `${GODOT_SOURCE_DIR}, or pass --godot-source <dir> with the clone that REFERENCES.md describes.`
  );
}
