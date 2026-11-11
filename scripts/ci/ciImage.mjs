#!/usr/bin/env node
/**
 * Names the container image that the browser and Godot jobs of CI run in: a hash of the image's
 * inputs, the Dockerfile and the locked Playwright. Two commits with the same inputs share an
 * image, and a commit that changes one runs in its own. CI appends `ref=<image>` and
 * `playwright-version=<version>` to $GITHUB_OUTPUT.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CI_IMAGE_DOCKERFILE = '.github/ci-image/Dockerfile';

/** ghcr.io accepts lower case only, so this is not `github.repository`. */
const CI_IMAGE_REPOSITORY = 'ghcr.io/vortiago/textscene-inspector/ci';

/** Long enough that two input sets never share a tag, short enough to read in a job log. */
const TAG_HEX_DIGITS = 16;

/**
 * @param {string} dockerfile - the text of the Dockerfile.
 * @param {string} playwrightVersion - the Playwright whose Chromium the image holds.
 * @returns {string} the image reference, `<repository>:<tag>`.
 */
export function ciImageRef(dockerfile, playwrightVersion) {
  const inputs = createHash('sha256').update(dockerfile).update('\0').update(playwrightVersion);
  return `${CI_IMAGE_REPOSITORY}:${inputs.digest('hex').slice(0, TAG_HEX_DIGITS)}`;
}

/**
 * @param {string} lockfile - the text of pnpm-lock.yaml.
 * @returns {string} the Playwright version of the root package, which `pnpm playwright:install` runs.
 */
export function lockedPlaywrightVersion(lockfile) {
  const rootPackage = lockfile.match(/^ {2}\.:\n(?: {4,}.*\n?)*/m)?.[0] ?? '';
  const version = rootPackage.match(/^ {6}playwright:\n {8}specifier: .*\n {8}version: (\S+)/m)?.[1];
  if (!version) {
    throw new Error('expected a playwright dependency of the root package in pnpm-lock.yaml, found none');
  }
  return version;
}

function main() {
  const playwrightVersion = lockedPlaywrightVersion(readFileSync('pnpm-lock.yaml', 'utf8'));
  console.log(`ref=${ciImageRef(readFileSync(CI_IMAGE_DOCKERFILE, 'utf8'), playwrightVersion)}`);
  console.log(`playwright-version=${playwrightVersion}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
