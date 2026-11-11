/**
 * The files the real-Godot tests read: the modules they import, the scenes they render and the
 * resources those scenes load. The pre-push plan runs the tests for a change to one of them, since
 * CI never does.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { ENGINE_TEST_FILE } from './engineTools.mjs';
import { resolveProjectRoot } from './run.mjs';

const HARNESS_DIR = 'scripts/godot-ref';
/** The global setup of the engine run. `vitest.config.ts` names it, so no test imports it. */
const ENGINE_TEST_SETUP = `${HARNESS_DIR}/engineTestSetup.mjs`;
/** Where a test finds a scene it names without a folder: its own scenes first, then the fixtures. */
const SCENE_DIRS = [`${HARNESS_DIR}/scenes`, 'scenes/fixtures'];
/** A text resource, which can load further resources. Any other file is a leaf. */
const TEXT_RESOURCE = /\.(?:tscn|tres)$/;

/**
 * The relative specifiers `src` imports or re-exports from: after `from`, in an import for its
 * side effect, and in a dynamic import.
 */
export function relativeSpecifiers(src) {
  return [...src.matchAll(/\b(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(
    ([, specifier]) => specifier
  );
}

/** The scene paths `src` names as string literals. */
export function sceneLiterals(src) {
  return [...src.matchAll(/['"`]([\w./-]+\.tscn)['"`]/g)].map(([, scene]) => scene);
}

/** The repository paths a scene literal can stand for. */
export function sceneCandidates(scene) {
  return scene.startsWith('scenes/') ? [scene] : SCENE_DIRS.map((dir) => `${dir}/${scene}`);
}

/**
 * The files among `scenes`, every resource they load through a `res://` path and the project file
 * of each, as repository paths. `rootOf` gives the `res://` root of a scene. `readSource` answers undefined for a path
 * that is no file, which the closure leaves out.
 */
export function resourceClosure(scenes, readSource, rootOf) {
  const seen = new Set();
  const visit = (path, root) => {
    if (seen.has(path)) return;
    const src = readSource(path);
    if (src === undefined) return;
    seen.add(path);
    if (!TEXT_RESOURCE.test(path)) return;
    for (const [, loaded] of src.matchAll(/\bpath="res:\/\/([^"]+)"/g)) visit(posix.join(root, loaded), root);
  };
  for (const scene of scenes) {
    const root = rootOf(scene);
    visit(scene, root);
    // The harness reads the project file of a rendered scene, and no scene names it.
    if (seen.has(scene)) visit(posix.join(root, 'project.godot'), root);
  }
  return seen;
}

/** The paths a specifier can name: itself, or the TypeScript module a `.js` specifier stands for. */
const sourceCandidates = (path) =>
  path.endsWith('.js') ? [path, path.replace(/\.js$/, '.ts'), path.replace(/\.js$/, '.tsx')] : [path];

/**
 * `entries` and every module they import through relative specifiers, as repository paths.
 * `readSource` answers undefined for a path that is no file. A `.js` specifier counts as the
 * TypeScript module it stands for, and the closure leaves out a specifier that names no file.
 */
export function importClosure(entries, readSource) {
  const seen = new Set();
  const visit = (specified) => {
    const path = sourceCandidates(specified).find(
      (candidate) => seen.has(candidate) || readSource(candidate) !== undefined
    );
    if (path === undefined || seen.has(path)) return;
    seen.add(path);
    for (const specifier of relativeSpecifiers(readSource(path))) {
      visit(posix.join(posix.dirname(path), specifier));
    }
  };
  entries.forEach(visit);
  return seen;
}

const repoPath = (file) => relative(REPO_ROOT, file).replaceAll('\\', '/');

function readRepoFile(path) {
  const file = join(REPO_ROOT, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/**
 * Whether the removed file `path` may have been an input: a file of the harness, or a scene the
 * tests still name. A removed file is in no closure, so this errs towards a run.
 */
export function wasEngineTestInput(path, sceneNames) {
  if (path.startsWith(`${HARNESS_DIR}/`)) return !path.endsWith('.md');
  return path.startsWith('scenes/') && sceneNames.has(posix.basename(path));
}

/** Written only by {@link engineTestInputs}, on its first call. The tree holds still during a run. */
let inputs;

function engineTestInputs() {
  if (inputs) return inputs;
  const tests = readdirSync(join(REPO_ROOT, HARNESS_DIR))
    .filter((name) => ENGINE_TEST_FILE.test(name))
    .map((name) => `${HARNESS_DIR}/${name}`);
  const scenes = tests.flatMap((test) => sceneLiterals(readRepoFile(test)));
  const rootOf = (scene) => repoPath(resolveProjectRoot(join(REPO_ROOT, scene)));
  inputs = {
    files: new Set([
      ...importClosure([...tests, ENGINE_TEST_SETUP], readRepoFile),
      ...resourceClosure(scenes.flatMap(sceneCandidates), readRepoFile, rootOf),
    ]),
    sceneNames: new Set(scenes.map((scene) => posix.basename(scene))),
  };
  return inputs;
}

/** Whether a change to the repository path `path` can move a real-Godot test. */
export function isEngineTestInput(path) {
  const { files, sceneNames } = engineTestInputs();
  return existsSync(join(REPO_ROOT, path)) ? files.has(path) : wasEngineTestInput(path, sceneNames);
}
