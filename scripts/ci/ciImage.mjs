#!/usr/bin/env node
/**
 * Names the container image that the browser jobs of CI run in: a hash of the image's inputs, the
 * Dockerfile and the locked Playwright. Two commits with the same inputs share an image, and a
 * commit that changes one runs in its own. CI appends `ref=<image>` and
 * `playwright-version=<version>` to $GITHUB_OUTPUT.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

/** Long enough that two input sets never share a tag, short enough to read in a job log. */
const TAG_HEX_DIGITS = 16;

/**
 * @param {string} repository - `<owner>/<name>` of the GitHub repository the run belongs to. A fork
 *   gets an image of its own, since its token cannot publish to another owner.
 * @param {string} dockerfile - the text of the Dockerfile.
 * @param {string} playwrightVersion - the Playwright whose Chromium the image holds.
 * @returns {string} the image reference on ghcr.io, in lower case, which is all ghcr.io accepts.
 */
export function ciImageRef(repository, dockerfile, playwrightVersion) {
  const inputs = createHash('sha256').update(dockerfile).update('\0').update(playwrightVersion);
  const tag = inputs.digest('hex').slice(0, TAG_HEX_DIGITS);
  return `ghcr.io/${repository.toLowerCase()}/ci:${tag}`;
}

/**
 * Patterns, not the `yaml` package: the image job runs this before any package is installed.
 * @param {string} lockfile - the text of pnpm-lock.yaml.
 * @returns {string} the Playwright version of the root package, without a peer suffix.
 */
export function lockedPlaywrightVersion(lockfile) {
  const rootPackage = lockfile.match(/^ {2}\.:\n(?: {4,}.*\n?)*/m)?.[0] ?? '';
  const version = rootPackage.match(/^ {6}playwright:\n {8}specifier: .*\n {8}version: ([^\s(]+)/m)?.[1];
  if (!version) {
    throw new Error('expected a playwright dependency of the root package in pnpm-lock.yaml, found none');
  }
  return version;
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error('expected GITHUB_REPOSITORY as <owner>/<name>, found none');
  const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8');
  const playwrightVersion = lockedPlaywrightVersion(read('pnpm-lock.yaml'));
  console.log(`ref=${ciImageRef(repository, read('.github/ci-image/Dockerfile'), playwrightVersion)}`);
  console.log(`playwright-version=${playwrightVersion}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
