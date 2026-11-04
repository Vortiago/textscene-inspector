/**
 * The steps of a test that installs a package as a user does: it runs the commands that build and
 * pack the package, names the tool versions the consumer pins, and type-checks the consumer.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire, findPackageJSON } from 'node:module';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';

/**
 * Runs `command` with `args` in `cwd`, and returns what it prints. It throws, with the output,
 * for a command that fails.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
export function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
}

/** Packs the package in `packageDir` into `destination`, and returns the path of its tarball. */
export function packTarball(packageDir, destination) {
  const output = run('pnpm', ['pack', '--json', '--pack-destination', destination], packageDir);
  // A lifecycle script of the package may print before the JSON.
  return JSON.parse(output.slice(output.indexOf('{'))).filename;
}

/**
 * The version of `name` that the workspace package at `base` tests against, so a consumer
 * installs the same one.
 *
 * @param {string} name
 * @param {string} base The workspace package's directory, relative to the repo root.
 * @returns {string}
 */
export function installedVersion(name, base) {
  const manifestPath = findPackageJSON(name, join(REPO_ROOT, base, 'package.json'));
  if (manifestPath === undefined) {
    throw new Error(`expected ${name} installed for ${base}, found none`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')).version;
}

/** TypeScript 7's `tsc` (ADR-0063). Its package exports no path to the command, so its manifest names it. */
function tscPath() {
  const manifestPath = createRequire(import.meta.url).resolve('@typescript/native/package.json');
  return join(dirname(manifestPath), JSON.parse(readFileSync(manifestPath, 'utf8')).bin.tsc);
}

/**
 * Type-checks the TypeScript project in `cwd` with the `tsc` a consumer runs, and returns what it
 * prints. It throws, with the output, on a type error.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function typeCheck(cwd) {
  return run('node', [tscPath(), '-p', '.'], cwd);
}
