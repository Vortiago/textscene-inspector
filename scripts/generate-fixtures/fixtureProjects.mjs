/**
 * The Fixture projects under a fixtures directory: each subdirectory with its own project.godot,
 * whose res:// root is that subdirectory, so its project settings reach no other fixture. The
 * generator lists their scenes and the manifest guard walks the same set, so the two cannot drift.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The Fixture project directory names in `fixturesDir`, sorted. */
export function fixtureProjects(fixturesDir) {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(fixturesDir, entry.name, 'project.godot')))
    .map((entry) => entry.name)
    .sort();
}
