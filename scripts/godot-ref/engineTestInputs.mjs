/**
 * The files the real-Godot tests read: the modules they import, the harness's own scenes and the
 * fixtures they render. The pre-push plan runs the tests for a change to one of them, since CI
 * never does.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { ENGINE_TEST_FILE } from './engineTools.mjs';

const HARNESS_DIR = 'scripts/godot-ref';
const FIXTURES_DIR = 'scenes/fixtures';
/** A harness file the tests read as data, such as a scene or a GDScript. A module counts by import. */
const HARNESS_ASSET = /^scripts\/godot-ref\/.*(?<!\.mjs|\.md)$/;

/** The relative specifiers `src` imports or re-exports from. */
export function relativeSpecifiers(src) {
  return [...src.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(([, specifier]) => specifier);
}

/** The scene paths `src` names as string literals. */
export function sceneLiterals(src) {
  return [...src.matchAll(/['"`]([\w./-]+\.tscn)['"`]/g)].map(([, scene]) => scene);
}

/**
 * The fixture a scene literal stands for, as a path prefix under the repository root: the file
 * of a top-level fixture, or the directory of a nested one, which holds what the scene loads.
 */
export function fixturePrefix(scene) {
  const underFixtures = scene.startsWith(`${FIXTURES_DIR}/`) ? scene.slice(FIXTURES_DIR.length + 1) : scene;
  const dir = posix.dirname(underFixtures);
  return dir === '.' ? `${FIXTURES_DIR}/${underFixtures}` : `${FIXTURES_DIR}/${dir}/`;
}

/**
 * `entries` and every module they import through relative specifiers, as repository paths.
 * `readSource` answers undefined for a path that is no file, such as a `.js` specifier of a
 * TypeScript module, which the closure leaves out.
 */
export function importClosure(entries, readSource) {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    const src = readSource(path);
    if (src === undefined) return;
    seen.add(path);
    for (const specifier of relativeSpecifiers(src)) visit(posix.join(posix.dirname(path), specifier));
  };
  entries.forEach(visit);
  return seen;
}

function readRepoFile(path) {
  const file = join(REPO_ROOT, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/** Whether a change to `path` can move a real-Godot test, given the modules and fixtures they read. */
export function readsEngineTestInput(path, { modules, fixturePrefixes }) {
  return (
    modules.has(path) || HARNESS_ASSET.test(path) || fixturePrefixes.some((prefix) => path.startsWith(prefix))
  );
}

/** Written only by {@link isEngineTestInput}, on its first call. The tree holds still during a run. */
let inputs;

/** Whether a change to the repository path `path` can move a real-Godot test. */
export function isEngineTestInput(path) {
  if (!inputs) {
    const tests = readdirSync(join(REPO_ROOT, HARNESS_DIR))
      .filter((name) => ENGINE_TEST_FILE.test(name))
      .map((name) => `${HARNESS_DIR}/${name}`);
    inputs = {
      modules: importClosure(tests, readRepoFile),
      fixturePrefixes: tests.flatMap((test) => sceneLiterals(readRepoFile(test)).map(fixturePrefix)),
    };
  }
  return readsEngineTestInput(path, inputs);
}
