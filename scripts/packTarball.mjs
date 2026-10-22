/**
 * Packs a package as a publish does, so a test installs the files a user would get.
 */

import { execFileSync } from 'node:child_process';

/** Packs the package in `packageDir` into `destination`, and returns the path of its tarball. */
export function packTarball(packageDir, destination) {
  const output = execFileSync('pnpm', ['pack', '--json', '--pack-destination', destination], {
    cwd: packageDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  // A lifecycle script of the package may print before the JSON.
  return JSON.parse(output.slice(output.indexOf('{'))).filename;
}
