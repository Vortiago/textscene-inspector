/**
 * Where a scene's `res://` paths start. The module imports no package, so the CI job that scopes
 * the real-Godot tests reads it before the workspace installs.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { FLATTENED_CORPUS_ROOTS } from '../corpusRoots.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

/**
 * The `res://` root for a scene: the nearest ancestor holding a `project.godot` (each vendored
 * demo is its own Godot project), else the scene's own directory. `scenes/fixtures` has no
 * project file, and its `res://` paths are relative to itself.
 */
export function resolveProjectRoot(scenePath) {
  let dir = dirname(resolve(scenePath));
  const stop = resolve(REPO_ROOT);
  const unmarkedRoots = FLATTENED_CORPUS_ROOTS.map((r) => resolve(join(stop, 'scenes', r)));
  while (dir.startsWith(stop) && dir !== stop) {
    if (existsSync(join(dir, 'project.godot'))) return dir;
    // A vendored closure that is a res:// root without saying so. Checked while
    // walking, so a scene nested inside one resolves against the corpus rather
    // than against its own folder.
    if (unmarkedRoots.includes(dir)) return dir;
    dir = dirname(dir);
  }
  return dirname(resolve(scenePath));
}
