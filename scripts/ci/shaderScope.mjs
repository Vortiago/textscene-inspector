#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The branch the port lands on. A pull request into any other branch runs every job. */
export const SHADER_BRANCH = 'feature/shader-translator';

/** The shader folders the previewer imports, so a change to one runs the previewer's jobs. */
const PREVIEWER_SHADER_FOLDERS = ['fault', 'pipeline', 'time'];

/** No file outside them imports one (`shaderScope.test.mjs`), so the previewer's jobs cannot see a change. */
const TRANSPILER_PATHS = new RegExp(
  `^(?:packages/textscene-core/src/shaders/(?!(?:${PREVIEWER_SHADER_FOLDERS.join('|')})/)[^/]+/` +
    '|apps/textscene-three-godot-shaders/|scripts/godot-shader-language/|scripts/godot-templates/|scripts/godot-probes/)'
);

/**
 * @param {string[]} changedPaths - repo-relative paths, as `git diff --name-only` prints them.
 * @param {string} baseRef - the pull request's base branch.
 * @returns {boolean} false for an empty list too: a diff that came back empty is more likely a
 *   broken checkout than a change to nothing.
 */
export function isShaderOnly(changedPaths, baseRef) {
  if (baseRef !== SHADER_BRANCH || changedPaths.length === 0) return false;
  return changedPaths.every((path) => TRANSPILER_PATHS.test(path));
}

/** Whether `path` is one of the transpiler's own files. */
export const isTranspilerPath = (path) => TRANSPILER_PATHS.test(path);

/** The paths in `git diff --name-only` output. Blank lines, and so a failed diff, give none. */
export const changedPathsOf = (diffOutput) =>
  diffOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function main() {
  const changedPaths = changedPathsOf(readFileSync(0, 'utf8'));
  const shaderOnly = isShaderOnly(changedPaths, process.env.BASE_REF ?? '');
  console.error(`[shaderScope] ${changedPaths.length} changed file(s): shader-only=${shaderOnly}`);
  console.log(`shader-only=${shaderOnly}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
