/**
 * Where a generator finds Godot's source: the directory a run passes as `--godot-source <dir>`, or
 * else `/opt/godot-source` in the CI image (`.github/ci-image/Dockerfile`) or the source a thread
 * container keeps. Only the generators in GODOT_SOURCE_READERS of `godot-source-decoupling.test.mjs`
 * read it.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The source tree of the CI image, at the tag of its Godot binary. */
export const GODOT_SOURCE_DIR = '/opt/godot-source';

/** Where a thread container keeps Godot's source at the reference binary's tag. */
export const CONTAINER_SOURCE_DIR = '/opt/textscene/godot-4.6.3';

/** A file every Godot 4 tree holds, so a wrong directory fails here and not in a parse. */
const MARKER = 'servers/rendering/shader_language.cpp';

/** The directories `argv` lets a generator read: the `--godot-source` value, or the known places. */
function candidateDirs(argv) {
  const flag = argv.indexOf('--godot-source');
  return flag >= 0 ? [resolve(argv[flag + 1] ?? '')] : [GODOT_SOURCE_DIR, CONTAINER_SOURCE_DIR];
}

/** The first candidate of `argv` that holds a Godot tree, or nothing when none does. */
export function foundGodotSourceDir(argv) {
  return candidateDirs(argv).find((dir) => existsSync(join(dir, MARKER)));
}

/**
 * The source directory for `argv`. Throws, naming how to get the source, when no candidate holds
 * a Godot tree.
 * @canonical Where a generator finds Godot's source
 */
export function godotSourceDir(argv) {
  const dir = foundGodotSourceDir(argv);
  if (dir) return dir;
  throw new Error(
    `expected Godot's source at ${candidateDirs(argv).join(' or ')}, found no ${MARKER}. Run in the ` +
      `CI image, which holds it at ${GODOT_SOURCE_DIR}, or pass --godot-source <dir> with the clone ` +
      'that REFERENCES.md describes.'
  );
}
