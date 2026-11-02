#!/usr/bin/env node
/**
 * The published packages' entry-point gate, which `check:package` runs beside publint: each
 * package the release registry marks `npm` must declare a root `.` export with `types` and
 * `import` conditions, and the files it names must ship. A bin-only manifest is the gap that left
 * Bundlephobia's "We could not guess a valid entry point" on `@textscene/linter` and
 * `@textscene/lsp`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_NPM_DIRECTORIES } from './ci/releaseVersion.mjs';
import { REPO_ROOT } from './repoRoot.mjs';

function readManifestAt(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Escapes a files-rule piece for a literal regex, with the `*` the caller splits already out. */
function escapeForRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `target`, a manifest path relative to the package root without its leading './', ships
 * under `files`: a plain rule covers its exact file and its directory subtree, a `*` covers one
 * path segment, and a `!` rule removes. No rule at all leaves every file in, as npm packs it.
 */
function isCoveredByFiles(target, files) {
  const rules = files ?? [];
  const positive = rules.filter((rule) => !rule.startsWith('!'));
  const negative = rules.filter((rule) => rule.startsWith('!')).map((rule) => rule.slice(1));
  const hit = (pattern) =>
    pattern.includes('*')
      ? new RegExp(`^${pattern.split('*').map(escapeForRegExp).join('[^/]*')}$`).test(target)
      : target === pattern || target.startsWith(`${pattern}/`);
  return (positive.length === 0 || positive.some(hit)) && !negative.some(hit);
}

/**
 * One problem per published manifest a bundler cannot guess an entry from: no `.` export, a `.`
 * export without its `types` or `import` condition, or an entry file the `files` list drops from
 * the tarball. A private package publishes nothing and answers nothing.
 *
 * @param {string} root - the repo root the package directories hang from.
 * @param {string[]} [packageDirs] - the published packages, or every one of them.
 * @param {(path: string) => object} [readManifest] - reads a package.json, so tests inject fixtures.
 * @returns {string[]}
 */
export function entryPointProblems(
  root,
  packageDirs = RELEASE_NPM_DIRECTORIES,
  readManifest = readManifestAt
) {
  const problems = [];
  for (const dir of packageDirs) {
    const label = `${dir}/package.json`;
    const manifest = readManifest(join(root, dir, 'package.json')) ?? {};
    if (manifest.private) continue;

    const entry = manifest.exports?.['.'];
    if (manifest.exports === undefined || entry === undefined) {
      problems.push(`${label}: exports["."] is missing, so no bundler can guess the entry point.`);
      continue;
    }
    if (typeof entry !== 'object') {
      problems.push(`${label}: exports["."] is a string, so it names no types condition.`);
      continue;
    }
    if (entry.types === undefined) {
      problems.push(`${label}: exports["."] names no types condition.`);
    }
    if (entry.import === undefined && entry.default === undefined) {
      problems.push(`${label}: exports["."] names no import condition.`);
    }

    for (const target of [manifest.main, manifest.types, ...Object.values(entry)]) {
      if (typeof target !== 'string') continue;
      if (!isCoveredByFiles(target.replace(/^\.\//, ''), manifest.files)) {
        problems.push(`${label}: ${target} is outside files, so the tarball drops it.`);
      }
    }
  }
  return problems;
}

function main() {
  const problems = entryPointProblems(REPO_ROOT);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[package-entry] ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log('[package-entry] every published package names an entry point its tarball ships');
}

// Only run when executed directly, so importing this entry never exits the importer.
// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
