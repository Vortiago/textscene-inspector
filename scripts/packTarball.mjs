/**
 * Packs a package as a publish does, so a test installs the files a user would get, and runs the
 * commands that build, pack and use it.
 */

import { execFileSync } from 'node:child_process';

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
